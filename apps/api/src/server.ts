import { createServer } from "node:http"
import { AUTOMATION_WORKER_CONCURRENCY } from "@handout/domain"
import { createApp } from "./app"
import { getCurrentActorFromHeaders } from "./auth/current-actor"
import {
  devActor,
  getDevAppBootstrap,
  isDevAuthBypassEnabled,
  provisionDevAuthBypass,
} from "./auth/dev-auth"
import { createDbBootstrapRepository } from "./bootstrap/repository"
import { createBootstrapService } from "./bootstrap/service"
import { createDbSiteCollaborationRepository } from "./collaboration/repository"
import {
  attachSiteCollaborationWebSocketServer,
  createSiteCollaborationServer,
} from "./collaboration/server"
import { env } from "./env"
import { parseAutomationEncryptionKey } from "./automations/crypto"
import { createAutomationWorker } from "./automations/service"
import { logger } from "./lib/logger"
import { createDbSiteRepository } from "./sites/repository"
import { createSiteService } from "./sites/service"
import { createDbTrackingV2Repository } from "./tracking/v2/repository"
import { createConfiguredTrackingV2RecordingObjectStore } from "./tracking/v2/recording-config"
import { createDbTrackingV2RecordingRepository } from "./tracking/v2/recording-repository"
import { createTrackingV2RetentionService, startTrackingV2RetentionJob } from "./tracking/v2/retention"

const bootstrapService = createBootstrapService(createDbBootstrapRepository())
const siteRepository = createDbSiteRepository()
const authorizationSiteService = createSiteService(siteRepository)
const collaboration = createSiteCollaborationServer({
  repository: createDbSiteCollaborationRepository(),
  async authorize({ headers, siteId, token }) {
    const useDevActor = isDevelopmentCollaborationToken(token) && isDevAuthBypassEnabled()
    const actor = useDevActor ? devActor : await getCurrentActorFromHeaders(headers)
    if (!actor) {
      throw new Error("Authentication required.")
    }

    const bootstrap = useDevActor
      ? getDevAppBootstrap()
      : await bootstrapService.getBootstrap(actor)
    const workspace = bootstrap.activeWorkspace
    if (!workspace) {
      throw new Error("Workspace is not available.")
    }

    const { site } = await authorizationSiteService.getSite({
      workspace: {
        id: workspace.id,
        plan: workspace.plan,
        role: workspace.role,
      },
      userId: actor.userId,
      siteId,
    })
    if (!site.permissions.canEdit || site.status === "archived") {
      throw new Error("You do not have permission to edit this site.")
    }

    return {
      userId: actor.userId,
      workspaceId: workspace.id,
      user: {
        id: actor.userId,
        name: actor.name?.trim() || actor.email,
        color: getPresenceColor(actor.userId),
      },
    }
  },
})
const siteService = createSiteService(siteRepository, {
  contentCoordinator: collaboration.coordinator,
})
const app = createApp({
  bootstrap: bootstrapService,
  sites: siteService,
})
const server = createServer(app)
const destroyCollaboration = attachSiteCollaborationWebSocketServer(
  server,
  collaboration.hocuspocus,
)
let stopTrackingRetentionJob = () => {}
let stopAutomationWorker = () => {}
let shuttingDown = false

await provisionDevAuthBypass()

server.listen(env.API_PORT, () => {
  logger.info("Handout API listening", {
    url: `http://localhost:${env.API_PORT}`,
  })

  if (env.TRACKING_V2_ENABLED && env.TRACKING_RETENTION_MODE === "in-process") {
    void startTrackingRetention()
  }
  if (env.AUTOMATIONS_ENABLED && env.AUTOMATIONS_WORKER_MODE === "in-process") {
    void startAutomationWorker()
  }
})

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    if (shuttingDown) return
    shuttingDown = true
    stopTrackingRetentionJob()
    stopAutomationWorker()
    const forceShutdown = setTimeout(() => {
      server.closeAllConnections()
      process.exit(0)
    }, process.env.NODE_ENV === "production" ? 10_000 : 1_000)
    forceShutdown.unref()
    server.close(() => {
      clearTimeout(forceShutdown)
      process.exit(0)
    })
    server.closeIdleConnections()
    void destroyCollaboration().finally(() => {
      server.closeIdleConnections()
    })
  })
}

async function startAutomationWorker() {
  if (!env.AUTOMATIONS_ENCRYPTION_KEY) return
  try {
    const { db } = await import("@handout/db")
    const worker = createAutomationWorker(db, {
      encryptionKey: parseAutomationEncryptionKey(env.AUTOMATIONS_ENCRYPTION_KEY),
      allowLocalDestinations: env.AUTOMATIONS_ALLOW_LOCAL_DESTINATIONS,
    })
    let running = false
    const tick = async () => {
      if (running || shuttingDown) return
      running = true
      try {
        for (let index = 0; index < 25; index += 1) {
          const concurrency = index === 0 ? 1 : AUTOMATION_WORKER_CONCURRENCY
          const results = await Promise.all(Array.from({ length: concurrency }, () => worker.runOnce()))
          if (!results.some((result) => result.retained || result.reconciled || result.fannedOut || result.delivered)) break
        }
      } catch (error) {
        logger.error("Automation worker tick failed", { error })
      } finally {
        running = false
      }
    }
    const timer = setInterval(() => void tick(), 5_000)
    timer.unref()
    stopAutomationWorker = () => clearInterval(timer)
    await tick()
  } catch (error) {
    logger.error("Automation worker failed to start", { error })
  }
}

async function startTrackingRetention() {
  try {
    const { db } = await import("@handout/db")
    if (shuttingDown) {
      return
    }

    const objectStore = createConfiguredTrackingV2RecordingObjectStore(env)
    stopTrackingRetentionJob = startTrackingV2RetentionJob({
      service: createTrackingV2RetentionService({
        repository: createDbTrackingV2Repository(db),
        ...(objectStore ? {
          recording: {
            objectStore,
            repository: createDbTrackingV2RecordingRepository(db),
          },
        } : {}),
      }),
      onError(error) {
        logger.error("Tracking retention failed", { error })
      },
      onResult(result) {
        if (result.sessionsExpired > 0 || result.recordingObjectsDeleted > 0) {
          logger.info("Completed tracking retention", result)
        }
      },
    })
  } catch (error) {
    logger.error("Tracking retention failed to start", { error })
  }
}

function getPresenceColor(userId: string) {
  const colors = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777"]
  let hash = 0
  for (const character of userId) {
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  }
  return colors[Math.abs(hash) % colors.length]!
}

function isDevelopmentCollaborationToken(token: string) {
  try {
    return (JSON.parse(token) as { dev?: unknown }).dev === true
  } catch {
    return false
  }
}
