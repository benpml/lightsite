import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import type { CurrentActor } from "./current-actor";

export type AgentAuthContext = {
  actor: CurrentActor;
  workspace: {
    id: string;
    plan: "basic" | "pro";
    role: "admin" | "user";
  };
};

export function getAgentAuthContext(request: Request): AgentAuthContext | null {
  const expectedToken = process.env.LIGHTSITE_AGENT_API_TOKEN;
  const workspaceId = process.env.LIGHTSITE_AGENT_WORKSPACE_ID;

  if (!expectedToken || !workspaceId) {
    return null;
  }

  const authorization = request.header("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token || !secureEquals(token, expectedToken)) {
    return null;
  }

  return {
    actor: {
      userId: process.env.LIGHTSITE_AGENT_USER_ID ?? "lightsite_agent",
      email: process.env.LIGHTSITE_AGENT_EMAIL ?? "agent@lightsite.app",
      emailVerified: true,
      name: process.env.LIGHTSITE_AGENT_NAME ?? "Lightsite Agent",
    },
    workspace: {
      id: workspaceId,
      plan: process.env.LIGHTSITE_AGENT_WORKSPACE_PLAN === "basic" ? "basic" : "pro",
      role: process.env.LIGHTSITE_AGENT_WORKSPACE_ROLE === "user" ? "user" : "admin",
    },
  };
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
