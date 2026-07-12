import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth";
import {
  devActor,
  isDevAuthBypassHeaders,
  isDevAuthBypassRequest,
} from "./dev-auth";

export type CurrentActor = {
  userId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  avatarUrl?: string;
};

export type CurrentActorProvider = (request: Request) => Promise<CurrentActor | null>;

type BetterAuthSession = {
  user?: {
    id?: string;
    email?: string | null;
    emailVerified?: boolean | null;
    name?: string | null;
    image?: string | null;
  } | null;
} | null;

export const getCurrentActor: CurrentActorProvider = async (request) => {
  if (isDevAuthBypassRequest(request)) {
    return devActor;
  }

  return getCurrentActorFromHeaders(fromNodeHeaders(request.headers));
};

export async function getCurrentActorFromHeaders(headers: Headers): Promise<CurrentActor | null> {
  if (isDevAuthBypassHeaders(headers)) {
    return devActor;
  }

  const session = await auth.api.getSession({
    headers,
  }) as BetterAuthSession;

  if (!session?.user?.id || !session.user.email) {
    return null;
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    emailVerified: session.user.emailVerified ?? false,
    ...(session.user.name ? { name: session.user.name } : {}),
    ...(session.user.image ? { avatarUrl: session.user.image } : {}),
  };
}
