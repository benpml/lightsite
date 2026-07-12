import { createServer } from "node:http"
import { createApp } from "./app"
import { getCurrentActorFromHeaders } from "./auth/current-actor"
import {
  devActor,
  getDevAppBootstrap,
  isDevAuthBypassEnabled,
} from "./auth/dev-auth"
import { createDbBootstrapRepository } from "./bootstrap/repository"
import { createBootstrapService } from "./bootstrap/service"
import { createDbSiteCollaborationRepository } from "./collaboration/repository"
import {
  attachSiteCollaborationWebSocketServer,
  createSiteCollaborationServer,
} from "./collaboration/server"
import { env } from "./env"
import { logger } from "./lib/logger"
import { createDbSiteRepository } from "./sites/repository"
import { createSiteService } from "./sites/service"
import { createDbTrackingV2Repository } from "./tracking/v2/repository"
import {
  createTrackingV2SessionExpirationService,
  startTrackingV2SessionExpirationJob,
} from "./tracking/v2/session-expiration"

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
let stopTrackingSessionExpirationJob = () => {}
let shuttingDown = false

server.listen(env.API_PORT, () => {
  logger.info("Lightsite API listening", {
    url: `http://localhost:${env.API_PORT}`,
  })

  if (env.TRACKING_V2_ENABLED) {
    void startTrackingSessionExpiration()
  }
})

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    shuttingDown = true
    stopTrackingSessionExpirationJob()
    void destroyCollaboration().finally(() => {
      server.close(() => process.exit(0))
    })
  })
}

async function startTrackingSessionExpiration() {
  try {
    const { db } = await import("@lightsite/db")
    if (shuttingDown) {
      return
    }

    stopTrackingSessionExpirationJob = startTrackingV2SessionExpirationJob({
      service: createTrackingV2SessionExpirationService({
        repository: createDbTrackingV2Repository(db),
      }),
      onError(error) {
        logger.error("Tracking session expiration failed", { error })
      },
      onResult(result) {
        if (result.expired > 0) {
          logger.info("Expired stale tracking sessions", result)
        }
      },
    })
  } catch (error) {
    logger.error("Tracking session expiration failed to start", { error })
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
