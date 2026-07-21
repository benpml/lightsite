import type { Database } from "@handout/db";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import type { AppBootstrap } from "../bootstrap/service";
import type { CurrentActor } from "./current-actor";

export const DEV_AUTH_BYPASS_HEADER = "x-handout-dev-auth";

export const devActor: CurrentActor = {
  userId: "dev_user_handout",
  email: "dev@handout.link",
  emailVerified: true,
  name: "Handout Dev",
};

export const devWorkspace = {
  id: "00000000-0000-4000-8000-000000000101",
  membershipId: "00000000-0000-4000-8000-000000000102",
  logoUrl: "/editor-assets/dev-workspace-logo.jpg",
  name: "Handout Dev",
  slug: "handout-dev",
  websiteDomain: "handout.link",
  plan: "pro",
} as const;

let devProfileImageUrl: string | undefined;

export function setDevProfileImageUrl(imageUrl: string | undefined) {
  devProfileImageUrl = imageUrl;
}

export function isDevAuthBypassRequest(request: Request) {
  return isDevAuthBypassEnabled() && request.header(DEV_AUTH_BYPASS_HEADER) === "1";
}

export function isDevAuthBypassHeaders(headers: Headers) {
  return isDevAuthBypassEnabled() && headers.get(DEV_AUTH_BYPASS_HEADER) === "1";
}

export function isDevAuthBypassEnabled() {
  return process.env.NODE_ENV !== "production";
}

export function resolveDevWorkspaceLogoUrl(workspaceId: string) {
  return isDevAuthBypassEnabled() && workspaceId === devWorkspace.id
    ? devWorkspace.logoUrl
    : null;
}

export function getDevAppBootstrap(): AppBootstrap {
  return {
    user: {
      id: devActor.userId,
      email: devActor.email,
      ...(devActor.name ? { name: devActor.name } : {}),
      ...(devProfileImageUrl ? { avatarUrl: devProfileImageUrl } : {}),
      accountSetupComplete: true,
      internalAccess: true,
    },
    activeWorkspace: {
      id: devWorkspace.id,
      slug: devWorkspace.slug,
      name: devWorkspace.name,
      websiteDomain: devWorkspace.websiteDomain,
      logoUrl: devWorkspace.logoUrl,
      plan: devWorkspace.plan,
      role: "admin",
      membershipId: devWorkspace.membershipId,
    },
    workspaces: [
      {
        id: devWorkspace.id,
        slug: devWorkspace.slug,
        name: devWorkspace.name,
        websiteDomain: devWorkspace.websiteDomain,
        logoUrl: devWorkspace.logoUrl,
        plan: devWorkspace.plan,
        role: "admin",
        membershipId: devWorkspace.membershipId,
      },
    ],
    onboarding: {
      nextStep: "app",
    },
  };
}

export async function provisionDevAuthBypass(database?: Database) {
  if (!isDevAuthBypassEnabled()) {
    return null;
  }

  const {
    db: defaultDb,
    user,
    userProfiles,
    workspaceMembers,
    workspaces,
  } = await import("@handout/db");
  const db = database ?? defaultDb;
  const now = new Date();

  await db.transaction(async (transaction) => {
    await transaction
      .insert(user)
      .values({
        id: devActor.userId,
        name: devActor.name ?? "Handout Dev",
        email: devActor.email,
        emailVerified: devActor.emailVerified,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: user.id,
        set: {
          name: devActor.name ?? "Handout Dev",
          email: devActor.email,
          emailVerified: devActor.emailVerified,
          updatedAt: now,
        },
      });

    const [workspace] = await transaction
      .insert(workspaces)
      .values({
        id: devWorkspace.id,
        name: devWorkspace.name,
        slug: devWorkspace.slug,
        websiteDomain: devWorkspace.websiteDomain,
        plan: devWorkspace.plan,
        status: "active",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: workspaces.id,
        set: {
          name: devWorkspace.name,
          slug: devWorkspace.slug,
          websiteDomain: devWorkspace.websiteDomain,
          plan: devWorkspace.plan,
          status: "active",
          updatedAt: now,
        },
      })
      .returning({ id: workspaces.id });

    if (!workspace) {
      throw new Error("Dev workspace provisioning did not return a row.");
    }

    await transaction
      .insert(workspaceMembers)
      .values({
        id: devWorkspace.membershipId,
        workspaceId: workspace.id,
        userId: devActor.userId,
        role: "admin",
        status: "active",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: workspaceMembers.id,
        set: {
          workspaceId: workspace.id,
          userId: devActor.userId,
          role: "admin",
          status: "active",
          removedAt: null,
          updatedAt: now,
        },
      });

    await transaction
      .insert(userProfiles)
      .values({
        userId: devActor.userId,
        accountSetupCompletedAt: now,
        lastActiveWorkspaceId: workspace.id,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          accountSetupCompletedAt: now,
          lastActiveWorkspaceId: workspace.id,
          updatedAt: now,
        },
      });
  });

  const [persistedUser] = await db
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, devActor.userId))
    .limit(1);
  setDevProfileImageUrl(persistedUser?.image ?? undefined);

  return devActor;
}
