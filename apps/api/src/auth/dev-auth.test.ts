import type { Request } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEV_AUTH_BYPASS_HEADER,
  devActor,
  getDevAppBootstrap,
  isDevAuthBypassRequest,
} from "./dev-auth";

function buildRequest(headers: Record<string, string | undefined>) {
  return {
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  } as Request;
}

describe("dev auth bypass", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("enables the dev actor when the local dev bypass header is present", () => {
    expect(isDevAuthBypassRequest(buildRequest({
      [DEV_AUTH_BYPASS_HEADER]: "1",
    }))).toBe(true);

    expect(devActor).toEqual({
      userId: "dev_user_handout",
      email: "dev@handout.link",
      emailVerified: true,
      name: "Handout Dev",
    });
  });

  it("is disabled in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(isDevAuthBypassRequest(buildRequest({
      [DEV_AUTH_BYPASS_HEADER]: "1",
    }))).toBe(false);
  });

  it("uses the uploaded workspace logo in the dev bootstrap", () => {
    const bootstrap = getDevAppBootstrap();

    expect(bootstrap.activeWorkspace?.logoUrl).toBe(
      "/editor-assets/dev-workspace-logo.jpg",
    );
    expect(bootstrap.workspaces[0]?.logoUrl).toBe(
      "/editor-assets/dev-workspace-logo.jpg",
    );
  });
});
