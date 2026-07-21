import { validateEmail } from "@handout/domain";
import type { CurrentActor } from "../auth/current-actor";
import type { TransactionalEmailSender } from "../email/transactional-email";
import type {
  TeamInvitationRecord,
  TeamMemberRecord,
  TeamRepository,
  TeamRole,
} from "./repository";

const INVITATION_LIFETIME_MS = 14 * 24 * 60 * 60 * 1_000;

export type TeamMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: TeamRole;
  joinedAt: string;
  lastActiveAt: string | null;
};

export type TeamInvitation = {
  id: string;
  email: string;
  role: TeamRole;
  status: "pending" | "expired";
  invitedByName: string | null;
  createdAt: string;
  expiresAt: string;
};

export interface TeamService {
  getTeam(input: { actor: CurrentActor; workspaceId: string }): Promise<{
    members: TeamMember[];
    invitations: TeamInvitation[];
    permissions: { canManageMembers: boolean };
  }>;
  invite(input: {
    actor: CurrentActor;
    workspaceId: string;
    email: string;
    role: TeamRole;
  }): Promise<"member_added" | "invitation_created">;
  updateMemberRole(input: {
    actor: CurrentActor;
    workspaceId: string;
    memberId: string;
    role: TeamRole;
  }): Promise<TeamMember>;
  removeMember(input: {
    actor: CurrentActor;
    workspaceId: string;
    memberId: string;
  }): Promise<void>;
  revokeInvitation(input: {
    actor: CurrentActor;
    workspaceId: string;
    invitationId: string;
  }): Promise<void>;
}

export class TeamAccessDeniedError extends Error {
  constructor(message = "You do not have access to this workspace team.") {
    super(message);
    this.name = "TeamAccessDeniedError";
  }
}

export class TeamAdminRequiredError extends Error {
  constructor() {
    super("Only workspace admins can manage members and invitations.");
    this.name = "TeamAdminRequiredError";
  }
}

export class TeamMemberNotFoundError extends Error {
  constructor() {
    super("Team member was not found.");
    this.name = "TeamMemberNotFoundError";
  }
}

export class TeamInvitationNotFoundError extends Error {
  constructor() {
    super("Invitation was not found.");
    this.name = "TeamInvitationNotFoundError";
  }
}

export class TeamMemberConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamMemberConflictError";
  }
}

export class TeamInvitationValidationError extends Error {
  readonly code: string;

  constructor(input: { code: string; message: string }) {
    super(input.message);
    this.name = "TeamInvitationValidationError";
    this.code = input.code;
  }
}

export function createTeamService(
  repository: TeamRepository,
  options: {
    now?: () => Date;
    email?: Pick<TransactionalEmailSender, "sendWorkspaceInvitation">;
    webOrigin?: string;
  } = {},
): TeamService {
  const now = options.now ?? (() => new Date());

  return {
    async getTeam(input) {
      const membership = await requireMembership(repository, input.workspaceId, input.actor.userId);
      const [members, invitations] = await Promise.all([
        repository.listMembers(input.workspaceId),
        membership.role === "admin" ? repository.listInvitations(input.workspaceId) : Promise.resolve([]),
      ]);
      const currentTime = now();

      return {
        members: members.map(serializeMember),
        invitations: invitations.map((invitation) => serializeInvitation(invitation, currentTime)),
        permissions: {
          canManageMembers: membership.role === "admin",
        },
      };
    },

    async invite(input) {
      await requireAdmin(repository, input.workspaceId, input.actor.userId);
      const emailResult = validateEmail(input.email);

      if (!emailResult.ok) {
        throw new TeamInvitationValidationError({
          code: emailResult.code,
          message: emailResult.message,
        });
      }

      const existingMember = await repository.findMemberByEmail(input.workspaceId, emailResult.email);
      if (existingMember) {
        throw new TeamMemberConflictError("This person is already a member of the workspace.");
      }

      const currentTime = now();
      const account = await repository.findUserByEmail(emailResult.email);

      if (account) {
        await repository.upsertMember({
          workspaceId: input.workspaceId,
          userId: account.id,
          role: input.role,
          now: currentTime,
        });
        await repository.markInvitationAccepted({
          workspaceId: input.workspaceId,
          email: emailResult.email,
          userId: account.id,
          now: currentTime,
        });
        return "member_added";
      }

      await repository.upsertInvitation({
        workspaceId: input.workspaceId,
        email: emailResult.email,
        role: input.role,
        invitedByUserId: input.actor.userId,
        expiresAt: new Date(currentTime.getTime() + INVITATION_LIFETIME_MS),
        now: currentTime,
      });

      if (options.email) {
        const workspaceName = await repository.findWorkspaceName(input.workspaceId);
        await options.email.sendWorkspaceInvitation({
          email: emailResult.email,
          inviterName: input.actor.name?.trim() || input.actor.email,
          workspaceName: workspaceName ?? "Handout workspace",
          role: input.role,
          acceptUrl: `${options.webOrigin ?? "http://localhost:5173"}/auth?mode=sign-up`,
        });
      }

      return "invitation_created";
    },

    async updateMemberRole(input) {
      await requireAdmin(repository, input.workspaceId, input.actor.userId);
      const member = await requireMember(repository, input.workspaceId, input.memberId);

      if (member.userId === input.actor.userId) {
        throw new TeamMemberConflictError("You cannot change your own workspace role.");
      }

      if (member.role === "admin" && input.role !== "admin") {
        await requireAnotherAdmin(repository, input.workspaceId);
      }

      await repository.updateMemberRole({
        workspaceId: input.workspaceId,
        memberId: input.memberId,
        role: input.role,
        now: now(),
      });

      const updated = await repository.findMember(input.workspaceId, input.memberId);
      if (!updated) throw new TeamMemberNotFoundError();
      return serializeMember(updated);
    },

    async removeMember(input) {
      await requireAdmin(repository, input.workspaceId, input.actor.userId);
      const member = await requireMember(repository, input.workspaceId, input.memberId);

      if (member.userId === input.actor.userId) {
        throw new TeamMemberConflictError("You cannot remove yourself from the workspace.");
      }

      if (member.role === "admin") {
        await requireAnotherAdmin(repository, input.workspaceId);
      }

      await repository.removeMember({
        workspaceId: input.workspaceId,
        memberId: input.memberId,
        now: now(),
      });
    },

    async revokeInvitation(input) {
      await requireAdmin(repository, input.workspaceId, input.actor.userId);
      const revoked = await repository.revokeInvitation({
        workspaceId: input.workspaceId,
        invitationId: input.invitationId,
        now: now(),
      });

      if (!revoked) throw new TeamInvitationNotFoundError();
    },
  };
}

async function requireMembership(repository: TeamRepository, workspaceId: string, userId: string) {
  const membership = await repository.findMembership(workspaceId, userId);
  if (!membership) throw new TeamAccessDeniedError();
  return membership;
}

async function requireAdmin(repository: TeamRepository, workspaceId: string, userId: string) {
  const membership = await requireMembership(repository, workspaceId, userId);
  if (membership.role !== "admin") throw new TeamAdminRequiredError();
  return membership;
}

async function requireMember(repository: TeamRepository, workspaceId: string, memberId: string) {
  const member = await repository.findMember(workspaceId, memberId);
  if (!member) throw new TeamMemberNotFoundError();
  return member;
}

async function requireAnotherAdmin(repository: TeamRepository, workspaceId: string) {
  if (await repository.countActiveAdmins(workspaceId) <= 1) {
    throw new TeamMemberConflictError("A workspace must keep at least one admin.");
  }
}

function serializeMember(member: TeamMemberRecord): TeamMember {
  return {
    id: member.id,
    userId: member.userId,
    name: member.name,
    email: member.email,
    avatarUrl: member.avatarUrl,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
    lastActiveAt: member.lastActiveAt?.toISOString() ?? null,
  };
}

function serializeInvitation(invitation: TeamInvitationRecord, now: Date): TeamInvitation {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.expiresAt <= now ? "expired" : "pending",
    invitedByName: invitation.invitedByName,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
  };
}
