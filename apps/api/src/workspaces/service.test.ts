import { describe, expect, it, vi } from "vitest";
import { createMemoryWorkspaceRepository } from "./repository";
import { createWorkspaceService } from "./service";

vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/handout";
});

describe("workspace transactional email", () => {
  it("queues a welcome email after creating a workspace", async () => {
    const sendWelcome = vi.fn().mockResolvedValue(undefined);
    const service = createWorkspaceService(createMemoryWorkspaceRepository(), {
      email: { sendWelcome },
      webOrigin: "https://app.handout.link",
    });

    const result = await service.createWorkspace({
      name: "Acme",
      website: "acme.com",
      creatorUserId: "user_123",
      creatorEmail: "ada@acme.com",
      creatorName: "Ada",
    });

    expect(sendWelcome).toHaveBeenCalledWith({
      email: "ada@acme.com",
      recipientName: "Ada",
      workspaceName: "Acme",
      sitesUrl: "https://app.handout.link/sites",
      workspaceId: result.workspace.id,
    });
  });
});
