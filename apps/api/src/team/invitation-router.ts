import {
  redeemWorkspaceInvitationRequestSchema,
  redeemWorkspaceInvitationResponseSchema,
} from "@handout/contracts"
import { Router } from "express"

import type { CurrentActorProvider } from "../auth/current-actor"
import { requireAuthenticatedActor } from "../auth/require-authenticated-actor"
import { asyncHandler } from "../http/async-handler"
import { AppError, issuesFromZodError } from "../http/errors"
import {
  TeamInvitationCodeError,
  type TeamService,
} from "./service"

export function createWorkspaceInvitationRouter(options: {
  getCurrentActor: CurrentActorProvider
  teamService: TeamService
}) {
  const router = Router()

  router.post("/redeem", asyncHandler(async (request, response) => {
    const actor = await requireAuthenticatedActor(request, options.getCurrentActor)
    const payload = redeemWorkspaceInvitationRequestSchema.safeParse(request.body ?? {})

    if (!payload.success) {
      throw new AppError({
        code: "team.invalid_invite_code",
        message: "Invalid workspace invite code.",
        status: 400,
        issues: issuesFromZodError(payload.error),
      })
    }

    try {
      const redeemed = await options.teamService.redeemInvitation({
        actor,
        code: payload.data.code,
      })
      response.json(redeemWorkspaceInvitationResponseSchema.parse({
        ...redeemed,
        requestId: request.context.requestId,
      }))
    } catch (error) {
      if (error instanceof TeamInvitationCodeError) {
        throw new AppError({
          code: "team.invalid_invite_code",
          message: error.message,
          status: 400,
        })
      }
      throw error
    }
  }))

  return router
}
