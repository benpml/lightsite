import { describe, expect, it } from "vitest"

import { appBootstrapResponseSchema } from "./api"

describe("app bootstrap response parser", () => {
  it("parses workspace switcher fields used by the shell", () => {
    expect(
      appBootstrapResponseSchema.parse({
        user: {
          id: "user_123",
          email: "mira@acme.com",
          name: "Mira Chen",
          accountSetupComplete: true,
          internalAccess: false,
        },
        activeWorkspace: {
          id: "workspace_123",
          slug: "acme",
          name: "Acme",
          websiteDomain: "acme.com",
          logoUrl: null,
          plan: "core",
          role: "admin",
          membershipId: "membership_123",
        },
        workspaces: [
          {
            id: "workspace_123",
            slug: "acme",
            name: "Acme",
            websiteDomain: "acme.com",
            logoUrl: null,
            plan: "core",
            role: "admin",
            membershipId: "membership_123",
          },
        ],
        onboarding: {
          nextStep: "app",
        },
        requestId: "request_123",
      }),
    ).toMatchObject({
      activeWorkspace: {
        id: "workspace_123",
        websiteDomain: "acme.com",
        plan: "core",
      },
      workspaces: [
        {
          id: "workspace_123",
          websiteDomain: "acme.com",
          plan: "core",
        },
      ],
    })
  })

  it("rejects workspace switcher items without website domain", () => {
    expect(() =>
      appBootstrapResponseSchema.parse({
        user: {
          id: "user_123",
          email: "mira@acme.com",
          accountSetupComplete: true,
          internalAccess: false,
        },
        activeWorkspace: {
          id: "workspace_123",
          slug: "acme",
          name: "Acme",
          logoUrl: null,
          plan: "core",
          role: "admin",
          membershipId: "membership_123",
        },
        workspaces: [],
        onboarding: {
          nextStep: "app",
        },
        requestId: "request_123",
      }),
    ).toThrow("Invalid workspace switcher item.")
  })
})
