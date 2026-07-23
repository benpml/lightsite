import { describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "../auth/current-actor";
import {
  createMemoryTeamRepository,
  type TeamInvitationRecord,
  type TeamMemberRecord,
} from "./repository";
import {
  createTeamService,
  TeamAdminRequiredError,
  TeamInvitationCodeError,
  TeamMemberConflictError,
} from "./service";
import { encodeWorkspaceInviteCode } from "./invite-code";

vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/handout";
});

const workspaceId = "00000000-0000-4000-8000-000000000101";
const now = new Date("2026-07-14T16:00:00.000Z");
const adminActor: CurrentActor = {
  userId: "user_admin",
  email: "admin@acme.com",
  emailVerified: true,
  name: "Ada Admin",
};

describe("team service", () => {
  it("returns real members while keeping invitations admin-only", async () => {
    const memberActor: CurrentActor = {
      userId: "user_member",
      email: "member@acme.com",
      emailVerified: true,
      name: "Mina Member",
    };
    const repository = createMemoryTeamRepository({
      members: [
        buildMember(),
        buildMember({
          id: "00000000-0000-4000-8000-000000000202",
          userId: memberActor.userId,
          name: memberActor.name ?? "Mina Member",
          email: memberActor.email,
          role: "user",
        }),
      ],
      invitations: [buildInvitation()],
    });
    const service = createTeamService(repository, { now: () => now });

    const result = await service.getTeam({ actor: memberActor, workspaceId });

    expect(result.members).toHaveLength(2);
    expect(result.invitations).toEqual([]);
    expect(result.permissions.canManageMembers).toBe(false);
  });

  it("adds an existing account directly to the workspace", async () => {
    const repository = createMemoryTeamRepository({
      members: [buildMember()],
      users: [{ id: "user_existing", email: "existing@acme.com" }],
    });
    const service = createTeamService(repository, { now: () => now });

    const result = await service.invite({
      actor: adminActor,
      workspaceId,
      email: " Existing@Acme.com ",
      role: "user",
    });
    const team = await service.getTeam({ actor: adminActor, workspaceId });

    expect(result).toBe("member_added");
    expect(team.members.map((member) => member.email)).toContain("existing@acme.com");
    expect(team.invitations).toEqual([]);
  });

  it("persists an invitation for a future account and marks expiration", async () => {
    const repository = createMemoryTeamRepository({ members: [buildMember()] });
    const service = createTeamService(repository, { now: () => now });

    await service.invite({
      actor: adminActor,
      workspaceId,
      email: "new@acme.com",
      role: "admin",
    });
    const active = await service.getTeam({ actor: adminActor, workspaceId });

    expect(active.invitations).toMatchObject([
      { email: "new@acme.com", role: "admin", status: "pending" },
    ]);

    const afterExpiration = createTeamService(repository, {
      now: () => new Date("2026-08-01T16:00:00.000Z"),
    });
    const expired = await afterExpiration.getTeam({ actor: adminActor, workspaceId });
    expect(expired.invitations[0]?.status).toBe("expired");
  });

  it("delivers a workspace invitation with real actor and workspace details", async () => {
    const repository = createMemoryTeamRepository({
      members: [buildMember()],
      workspaceNames: { [workspaceId]: "Acme Sales" },
    });
    const sendWorkspaceInvitation = vi.fn().mockResolvedValue(undefined);
    const service = createTeamService(repository, {
      now: () => now,
      email: { sendWorkspaceInvitation },
      webOrigin: "https://app.handout.link",
    });

    await service.invite({
      actor: adminActor,
      workspaceId,
      email: "new@acme.com",
      role: "user",
    });

    const invitation = (await service.getTeam({ actor: adminActor, workspaceId })).invitations[0]!;
    const code = encodeWorkspaceInviteCode(invitation.id);

    expect(sendWorkspaceInvitation).toHaveBeenCalledWith({
      email: "new@acme.com",
      inviterName: "Ada Admin",
      workspaceName: "Acme Sales",
      role: "user",
      acceptUrl: `https://app.handout.link/auth?mode=sign-up&returnTo=${encodeURIComponent(`/onboarding/join?code=${code}`)}`,
    });
  });

  it("redeems an invitation code for the matching signed-in email", async () => {
    const invitedActor: CurrentActor = {
      userId: "user_invited",
      email: "invited@acme.com",
      emailVerified: true,
      name: "Ivy Invited",
    };
    const invitation = buildInvitation({ email: invitedActor.email });
    const repository = createMemoryTeamRepository({
      members: [buildMember()],
      invitations: [invitation],
      users: [{ id: invitedActor.userId, email: invitedActor.email }],
    });
    const service = createTeamService(repository, { now: () => now });

    await expect(service.redeemInvitation({
      actor: invitedActor,
      code: encodeWorkspaceInviteCode(invitation.id),
    })).resolves.toEqual({ workspaceId });

    const team = await service.getTeam({ actor: adminActor, workspaceId });
    expect(team.members.map((member) => member.email)).toContain(invitedActor.email);
    expect(team.invitations).toEqual([]);
  });

  it("does not redeem an invite code for another email", async () => {
    const invitation = buildInvitation();
    const repository = createMemoryTeamRepository({
      members: [buildMember()],
      invitations: [invitation],
    });
    const service = createTeamService(repository, { now: () => now });

    await expect(service.redeemInvitation({
      actor: adminActor,
      code: encodeWorkspaceInviteCode(invitation.id),
    })).rejects.toBeInstanceOf(TeamInvitationCodeError);
  });

  it("allows personal email domains and plus aliases in invitations", async () => {
    const repository = createMemoryTeamRepository({ members: [buildMember()] });
    const service = createTeamService(repository, { now: () => now });

    await service.invite({
      actor: adminActor,
      workspaceId,
      email: " New+Handout@Gmail.com ",
      role: "user",
    });

    const team = await service.getTeam({ actor: adminActor, workspaceId });
    expect(team.invitations[0]?.email).toBe("new+handout@gmail.com");
  });

  it("requires an admin for mutations", async () => {
    const memberActor: CurrentActor = {
      userId: "user_member",
      email: "member@acme.com",
      emailVerified: true,
    };
    const repository = createMemoryTeamRepository({
      members: [
        buildMember(),
        buildMember({
          id: "00000000-0000-4000-8000-000000000202",
          userId: memberActor.userId,
          email: memberActor.email,
          role: "user",
        }),
      ],
    });
    const service = createTeamService(repository, { now: () => now });

    await expect(service.invite({
      actor: memberActor,
      workspaceId,
      email: "new@acme.com",
      role: "user",
    })).rejects.toBeInstanceOf(TeamAdminRequiredError);
  });

  it("protects the current admin from removing or demoting themselves", async () => {
    const repository = createMemoryTeamRepository({ members: [buildMember()] });
    const service = createTeamService(repository, { now: () => now });
    const admin = (await service.getTeam({ actor: adminActor, workspaceId })).members[0]!;

    await expect(service.updateMemberRole({
      actor: adminActor,
      workspaceId,
      memberId: admin.id,
      role: "user",
    })).rejects.toBeInstanceOf(TeamMemberConflictError);

    await expect(service.removeMember({
      actor: adminActor,
      workspaceId,
      memberId: admin.id,
    })).rejects.toBeInstanceOf(TeamMemberConflictError);
  });
});

function buildMember(overrides: Partial<TeamMemberRecord> = {}): TeamMemberRecord {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    workspaceId,
    userId: adminActor.userId,
    name: adminActor.name ?? "Ada Admin",
    email: adminActor.email,
    avatarUrl: null,
    role: "admin",
    joinedAt: new Date("2026-01-01T12:00:00.000Z"),
    lastActiveAt: now,
    ...overrides,
  };
}

function buildInvitation(overrides: Partial<TeamInvitationRecord> = {}): TeamInvitationRecord {
  return {
    id: "00000000-0000-4000-8000-000000000301",
    workspaceId,
    email: "pending@acme.com",
    role: "user",
    status: "pending",
    invitedByName: "Ada Admin",
    createdAt: now,
    expiresAt: new Date("2026-07-28T16:00:00.000Z"),
    ...overrides,
  };
}
