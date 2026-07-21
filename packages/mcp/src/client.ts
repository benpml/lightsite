import { sanitizeAgentOutput } from "./agent-output";

export type HandoutClientOptions = {
  apiBaseUrl: string;
  authorization?: string;
  devAuth?: boolean;
  publicSiteOrigin?: string;
  webOrigin?: string;
  workspaceId?: string;
  workspaceSlug?: string;
};

export class HandoutClient {
  readonly apiBaseUrl: string;
  readonly publicSiteOrigin?: string;
  readonly webOrigin?: string;
  readonly workspaceId?: string;
  readonly workspaceSlug?: string;
  private readonly authorization?: string;
  private readonly devAuth: boolean;

  constructor(options: HandoutClientOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, "");
    this.authorization = options.authorization;
    this.devAuth = options.devAuth === true;
    this.publicSiteOrigin = options.publicSiteOrigin?.replace(/\/$/, "");
    this.webOrigin = options.webOrigin?.replace(/\/$/, "");
    this.workspaceId = options.workspaceId;
    this.workspaceSlug = options.workspaceSlug;
  }

  async request(path: string, options: {
    body?: unknown;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  } = {}) {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
        ...(this.authorization ? { authorization: this.authorization } : {}),
        ...(this.devAuth ? { "x-handout-dev-auth": "1" } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    const payload = parseJson(text);

    if (!response.ok) {
      throw new HandoutApiError(response.status, payload);
    }

    return sanitizeAgentOutput(removeInternalResponseMetadata(payload));
  }

  editorUrl(siteId: string) {
    return this.webOrigin ? `${this.webOrigin}/edit/${encodeURIComponent(siteId)}` : null;
  }

  async resolveWorkspace() {
    if (this.workspaceId && this.workspaceSlug) {
      return { id: this.workspaceId, slug: this.workspaceSlug };
    }

    const me = await this.request("/api/me");
    if (!isRecord(me) || !isRecord(me.activeWorkspace)) {
      throw new Error("Select an active Handout workspace before using this tool.");
    }

    const id = me.activeWorkspace.id;
    const slug = me.activeWorkspace.slug;
    if (typeof id !== "string" || typeof slug !== "string") {
      throw new Error("Handout returned an invalid active workspace.");
    }

    return { id, slug };
  }
}

export class HandoutApiError extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(`Handout API request failed with status ${status}.`);
    this.name = "HandoutApiError";
    this.payload = sanitizeAgentOutput(removeInternalResponseMetadata(payload));
  }
}

export function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function removeInternalResponseMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeInternalResponseMetadata);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "requestId")
      .map(([key, child]) => [key, removeInternalResponseMetadata(child)]),
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
