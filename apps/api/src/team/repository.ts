import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import {
  db as defaultDb,
  session,
  user,
  workspaceInvitations,
  workspaceMembers,
  workspaces,
  type Database,
} from "@handout/db";

export type TeamRole = "admin" | "user";

export type TeamMembershipRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  role: TeamRole;
  status: "active" | "removed";
};

export type TeamMemberRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: TeamRole;
  joinedAt: Date;
  lastActiveAt: Date | null;
};

export type TeamInvitationRecord = {
  id: string;
  workspaceId: string;
  email: string;
  role: TeamRole;
  status: "pending" | "accepted" | "revoked";
  invitedByName: string | null;
  expiresAt: Date;
  createdAt: Date;
};

export type TeamUserRecord = {
  id: string;
  email: string;
};

export interface TeamRepository {
  findWorkspaceName(workspaceId: string): Promise<string | null>;
  findMembership(workspaceId: string, userId: string): Promise<TeamMembershipRecord | null>;
  findMember(workspaceId: string, memberId: string): Promise<TeamMemberRecord | null>;
  findMemberByEmail(workspaceId: string, email: string): Promise<TeamMemberRecord | null>;
  findUserByEmail(email: string): Promise<TeamUserRecord | null>;
  listMembers(workspaceId: string): Promise<TeamMemberRecord[]>;
  listInvitations(workspaceId: string): Promise<TeamInvitationRecord[]>;
  countActiveAdmins(workspaceId: string): Promise<number>;
  upsertMember(input: {
    workspaceId: string;
    userId: string;
    role: TeamRole;
    now: Date;
  }): Promise<void>;
  upsertInvitation(input: {
    workspaceId: string;
    email: string;
    role: TeamRole;
    invitedByUserId: string;
    expiresAt: Date;
    now: Date;
  }): Promise<void>;
  markInvitationAccepted(input: {
    workspaceId: string;
    email: string;
    userId: string;
    now: Date;
  }): Promise<void>;
  updateMemberRole(input: {
    workspaceId: string;
    memberId: string;
    role: TeamRole;
    now: Date;
  }): Promise<void>;
  removeMember(input: {
    workspaceId: string;
    memberId: string;
    now: Date;
  }): Promise<void>;
  revokeInvitation(input: {
    workspaceId: string;
    invitationId: string;
    now: Date;
  }): Promise<boolean>;
}

export function createDbTeamRepository(database: Database = defaultDb): TeamRepository {
  return {
    async findWorkspaceName(workspaceId) {
      const [record] = await database
        .select({ name: workspaces.name })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      return record?.name ?? null;
    },

    async findMembership(workspaceId, userId) {
      const [membership] = await database
        .select({
          id: workspaceMembers.id,
          workspaceId: workspaceMembers.workspaceId,
          userId: workspaceMembers.userId,
          role: workspaceMembers.role,
          status: workspaceMembers.status,
        })
        .from(workspaceMembers)
        .where(and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, "active"),
        ))
        .limit(1);

      return membership ?? null;
    },

    async findMember(workspaceId, memberId) {
      const [member] = await memberQuery(database)
        .where(and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.id, memberId),
          eq(workspaceMembers.status, "active"),
        ))
        .limit(1);

      return member ?? null;
    },

    async findMemberByEmail(workspaceId, email) {
      const [member] = await memberQuery(database)
        .where(and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.status, "active"),
          eq(user.email, email),
        ))
        .limit(1);

      return member ?? null;
    },

    async findUserByEmail(email) {
      const [record] = await database
        .select({ id: user.id, email: user.email })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);

      return record ?? null;
    },

    async listMembers(workspaceId) {
      return memberQuery(database)
        .where(and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.status, "active"),
        ))
        .orderBy(desc(workspaceMembers.createdAt));
    },

    async listInvitations(workspaceId) {
      return database
        .select({
          id: workspaceInvitations.id,
          workspaceId: workspaceInvitations.workspaceId,
          email: workspaceInvitations.email,
          role: workspaceInvitations.role,
          status: workspaceInvitations.status,
          invitedByName: user.name,
          expiresAt: workspaceInvitations.expiresAt,
          createdAt: workspaceInvitations.createdAt,
        })
        .from(workspaceInvitations)
        .leftJoin(user, eq(workspaceInvitations.invitedByUserId, user.id))
        .where(and(
          eq(workspaceInvitations.workspaceId, workspaceId),
          eq(workspaceInvitations.status, "pending"),
        ))
        .orderBy(desc(workspaceInvitations.createdAt));
    },

    async countActiveAdmins(workspaceId) {
      const [result] = await database
        .select({ count: sql<number>`count(*)::int` })
        .from(workspaceMembers)
        .where(and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.status, "active"),
          eq(workspaceMembers.role, "admin"),
        ));

      return result?.count ?? 0;
    },

    async upsertMember(input) {
      await database
        .insert(workspaceMembers)
        .values({
          workspaceId: input.workspaceId,
          userId: input.userId,
          role: input.role,
          status: "active",
          updatedAt: input.now,
        })
        .onConflictDoUpdate({
          target: [workspaceMembers.workspaceId, workspaceMembers.userId],
          set: {
            role: input.role,
            status: "active",
            removedAt: null,
            updatedAt: input.now,
          },
        });
    },

    async upsertInvitation(input) {
      await database
        .insert(workspaceInvitations)
        .values({
          workspaceId: input.workspaceId,
          email: input.email,
          role: input.role,
          status: "pending",
          invitedByUserId: input.invitedByUserId,
          expiresAt: input.expiresAt,
          updatedAt: input.now,
        })
        .onConflictDoUpdate({
          target: [workspaceInvitations.workspaceId, workspaceInvitations.email],
          set: {
            role: input.role,
            status: "pending",
            invitedByUserId: input.invitedByUserId,
            acceptedByUserId: null,
            expiresAt: input.expiresAt,
            acceptedAt: null,
            revokedAt: null,
            updatedAt: input.now,
          },
        });
    },

    async markInvitationAccepted(input) {
      await database
        .update(workspaceInvitations)
        .set({
          status: "accepted",
          acceptedByUserId: input.userId,
          acceptedAt: input.now,
          updatedAt: input.now,
        })
        .where(and(
          eq(workspaceInvitations.workspaceId, input.workspaceId),
          eq(workspaceInvitations.email, input.email),
        ));
    },

    async updateMemberRole(input) {
      await database
        .update(workspaceMembers)
        .set({ role: input.role, updatedAt: input.now })
        .where(and(
          eq(workspaceMembers.workspaceId, input.workspaceId),
          eq(workspaceMembers.id, input.memberId),
          eq(workspaceMembers.status, "active"),
        ));
    },

    async removeMember(input) {
      await database
        .update(workspaceMembers)
        .set({ status: "removed", removedAt: input.now, updatedAt: input.now })
        .where(and(
          eq(workspaceMembers.workspaceId, input.workspaceId),
          eq(workspaceMembers.id, input.memberId),
          eq(workspaceMembers.status, "active"),
        ));
    },

    async revokeInvitation(input) {
      const revoked = await database
        .update(workspaceInvitations)
        .set({ status: "revoked", revokedAt: input.now, updatedAt: input.now })
        .where(and(
          eq(workspaceInvitations.workspaceId, input.workspaceId),
          eq(workspaceInvitations.id, input.invitationId),
          eq(workspaceInvitations.status, "pending"),
        ))
        .returning({ id: workspaceInvitations.id });

      return revoked.length > 0;
    },
  };
}

export async function claimWorkspaceInvitationsForUser(
  input: { userId: string; email: string; now?: Date },
  database: Database = defaultDb,
) {
  const now = input.now ?? new Date();

  await database.transaction(async (transaction) => {
    const invitations = await transaction
      .select({
        id: workspaceInvitations.id,
        workspaceId: workspaceInvitations.workspaceId,
        role: workspaceInvitations.role,
      })
      .from(workspaceInvitations)
      .where(and(
        eq(workspaceInvitations.email, input.email.toLowerCase()),
        eq(workspaceInvitations.status, "pending"),
        gt(workspaceInvitations.expiresAt, now),
      ));

    if (invitations.length === 0) return;

    for (const invitation of invitations) {
      await transaction
        .insert(workspaceMembers)
        .values({
          workspaceId: invitation.workspaceId,
          userId: input.userId,
          role: invitation.role,
          status: "active",
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [workspaceMembers.workspaceId, workspaceMembers.userId],
          set: {
            role: invitation.role,
            status: "active",
            removedAt: null,
            updatedAt: now,
          },
        });
    }

    await transaction
      .update(workspaceInvitations)
      .set({
        status: "accepted",
        acceptedByUserId: input.userId,
        acceptedAt: now,
        updatedAt: now,
      })
      .where(inArray(workspaceInvitations.id, invitations.map((invitation) => invitation.id)));
  });
}

export function createMemoryTeamRepository(input: {
  members?: TeamMemberRecord[];
  invitations?: TeamInvitationRecord[];
  users?: TeamUserRecord[];
  workspaceNames?: Record<string, string>;
} = {}): TeamRepository {
  const members = [...(input.members ?? [])];
  const invitations = [...(input.invitations ?? [])];
  const users = [...(input.users ?? [])];

  return {
    async findWorkspaceName(workspaceId) {
      return input.workspaceNames?.[workspaceId] ?? "Handout workspace";
    },

    async findMembership(workspaceId, userId) {
      const member = members.find((candidate) =>
        candidate.workspaceId === workspaceId && candidate.userId === userId
      );
      return member ? {
        id: member.id,
        workspaceId: member.workspaceId,
        userId: member.userId,
        role: member.role,
        status: "active",
      } : null;
    },
    async findMember(workspaceId, memberId) {
      return members.find((member) => member.workspaceId === workspaceId && member.id === memberId) ?? null;
    },
    async findMemberByEmail(workspaceId, email) {
      return members.find((member) => member.workspaceId === workspaceId && member.email === email) ?? null;
    },
    async findUserByEmail(email) {
      return users.find((candidate) => candidate.email === email) ?? null;
    },
    async listMembers(workspaceId) {
      return members.filter((member) => member.workspaceId === workspaceId);
    },
    async listInvitations(workspaceId) {
      return invitations.filter((invitation) =>
        invitation.workspaceId === workspaceId && invitation.status === "pending"
      );
    },
    async countActiveAdmins(workspaceId) {
      return members.filter((member) => member.workspaceId === workspaceId && member.role === "admin").length;
    },
    async upsertMember(member) {
      const existing = members.find((candidate) =>
        candidate.workspaceId === member.workspaceId && candidate.userId === member.userId
      );
      if (existing) {
        existing.role = member.role;
        return;
      }
      const account = users.find((candidate) => candidate.id === member.userId);
      if (!account) throw new Error("Memory team user was not found.");
      members.push({
        id: randomUUID(),
        workspaceId: member.workspaceId,
        userId: member.userId,
        name: account.email.split("@")[0] ?? account.email,
        email: account.email,
        avatarUrl: null,
        role: member.role,
        joinedAt: member.now,
        lastActiveAt: null,
      });
    },
    async upsertInvitation(invitation) {
      const existing = invitations.find((candidate) =>
        candidate.workspaceId === invitation.workspaceId && candidate.email === invitation.email
      );
      if (existing) {
        existing.role = invitation.role;
        existing.status = "pending";
        existing.expiresAt = invitation.expiresAt;
        return;
      }
      invitations.push({
        id: randomUUID(),
        workspaceId: invitation.workspaceId,
        email: invitation.email,
        role: invitation.role,
        status: "pending",
        invitedByName: null,
        createdAt: invitation.now,
        expiresAt: invitation.expiresAt,
      });
    },
    async markInvitationAccepted(accepted) {
      const invitation = invitations.find((candidate) =>
        candidate.workspaceId === accepted.workspaceId && candidate.email === accepted.email
      );
      if (invitation) invitation.status = "accepted";
    },
    async updateMemberRole(update) {
      const member = members.find((candidate) =>
        candidate.workspaceId === update.workspaceId && candidate.id === update.memberId
      );
      if (member) member.role = update.role;
    },
    async removeMember(removal) {
      const index = members.findIndex((candidate) =>
        candidate.workspaceId === removal.workspaceId && candidate.id === removal.memberId
      );
      if (index >= 0) members.splice(index, 1);
    },
    async revokeInvitation(revocation) {
      const invitation = invitations.find((candidate) =>
        candidate.workspaceId === revocation.workspaceId && candidate.id === revocation.invitationId
      );
      if (!invitation || invitation.status !== "pending") return false;
      invitation.status = "revoked";
      return true;
    },
  };
}

function memberQuery(database: Database) {
  return database
    .select({
      id: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      name: user.name,
      email: user.email,
      avatarUrl: user.image,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.createdAt,
      lastActiveAt: sql<Date | null>`(
        select max(${session.updatedAt})
        from ${session}
        where ${session.userId} = ${user.id}
      )`,
    })
    .from(workspaceMembers)
    .innerJoin(user, eq(workspaceMembers.userId, user.id));
}
