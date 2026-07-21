import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { isIP } from "node:net";
import { AUTOMATION_LIMITS } from "@handout/domain";

export class UnsafeAutomationDestinationError extends Error {
  readonly code = "destination_unsafe";
  constructor(message = "Use a public HTTPS URL that accepts webhook requests.") {
    super(message);
    this.name = "UnsafeAutomationDestinationError";
  }
}

export function parseAutomationDestination(raw: string, options: { allowLocal?: boolean } = {}) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeAutomationDestinationError("Enter a valid HTTPS URL.");
  }
  if (url.username || url.password || url.hash) {
    throw new UnsafeAutomationDestinationError("Webhook URLs cannot contain credentials or a # fragment.");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const isLocalHostname = hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local");
  const isLocalIp = Boolean(isIP(hostname) && isBlockedAddress(hostname));
  const isDevelopmentLocalTarget = Boolean(options.allowLocal && (isLocalHostname || isLocalIp));
  if (!hostname || ((isLocalHostname || isLocalIp) && !options.allowLocal) || (Boolean(isIP(hostname)) && !isLocalIp)) {
    throw new UnsafeAutomationDestinationError();
  }
  if (url.protocol !== "https:" && !(isDevelopmentLocalTarget && url.protocol === "http:")) {
    throw new UnsafeAutomationDestinationError("Webhook URLs must use HTTPS.");
  }
  const allowedPort = url.protocol === "https:" ? "443" : "80";
  if (url.port && url.port !== allowedPort && !isDevelopmentLocalTarget) {
    throw new UnsafeAutomationDestinationError("Webhook URLs must use the standard HTTPS port.");
  }
  url.hostname = hostname;
  return url;
}

export async function sendSafeWebhook(input: {
  url: string;
  body: string;
  headers: Record<string, string>;
  allowLocal?: boolean;
}) {
  const url = parseAutomationDestination(input.url, { allowLocal: input.allowLocal });
  const addresses = await lookupWithTimeout(url.hostname);
  if (addresses.length === 0) throw new UnsafeAutomationDestinationError("The webhook host could not be resolved.");
  if (!input.allowLocal && addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new UnsafeAutomationDestinationError();
  }
  const pinned = addresses[0]!;

  return new Promise<{ status: number }>((resolve, reject) => {
    let settled = false;
    let totalTimer: NodeJS.Timeout | undefined;
    const finish = (error?: Error, result?: { status: number }) => {
      if (settled) return;
      settled = true;
      if (totalTimer) clearTimeout(totalTimer);
      error ? reject(error) : resolve(result!);
    };
    const requestFn = url.protocol === "https:" ? httpsRequest : httpRequest;
    const request = requestFn({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "POST",
      servername: url.protocol === "https:" ? url.hostname : undefined,
      lookup(_hostname, _options, callback) {
        callback(null, pinned.address, pinned.family);
      },
      headers: {
        accept: "application/json",
        "accept-encoding": "identity",
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(input.body),
        "user-agent": "Handout-Webhooks/1.0",
        ...input.headers,
      },
    }, (response) => {
      const status = response.statusCode ?? 0;
      response.destroy();
      if (status < 100 || status > 599) finish(new Error("Webhook returned an invalid HTTP status."));
      else finish(undefined, { status });
    });
    request.on("socket", (socket) => {
      socket.setTimeout(AUTOMATION_LIMITS.connectTimeoutMs, () => {
        request.destroy(new Error("Webhook connection timed out."));
      });
      socket.once("secureConnect", () => socket.setTimeout(0));
      socket.once("connect", () => {
        if (url.protocol === "http:") socket.setTimeout(0);
      });
    });
    request.on("error", (error) => finish(error));
    totalTimer = setTimeout(() => request.destroy(new Error("Webhook request timed out.")), AUTOMATION_LIMITS.requestTimeoutMs);
    totalTimer.unref();
    request.end(input.body);
  });
}

async function lookupWithTimeout(hostname: string) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new UnsafeAutomationDestinationError("The webhook host took too long to resolve.")), AUTOMATION_LIMITS.connectTimeoutMs);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function isBlockedAddress(address: string) {
  if (address === "::" || address === "::1" || address === "0.0.0.0") return true;
  const mapped = address.toLowerCase().startsWith("::ffff:") ? address.slice(7) : address;
  if (isIP(mapped) === 4) {
    const parts = mapped.split(".").map(Number);
    const [a, b] = parts;
    return a === 0 || a === 10 || a === 127 || a! >= 224 ||
      (a === 100 && b! >= 64 && b! <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b! >= 16 && b! <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 88 && parts[2] === 99) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && parts[2] === 100) ||
      (a === 203 && b === 0 && parts[2] === 113);
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    const hextets = normalized.split(":");
    // Only globally routable unicast space (2000::/3) is a valid webhook target.
    // This intentionally rejects IPv4-mapped, NAT64, loopback, link-local, ULA,
    // multicast, and currently unallocated ranges even when they use an expanded
    // spelling that a prefix check such as `::1` would miss.
    const first = Number.parseInt(hextets[0] || "0", 16);
    if (first < 0x2000 || first > 0x3fff) return true;
    const isSpecial2001 = hextets[0] === "2001" && Number.parseInt(hextets[1] || "0", 16) <= 0x01ff;
    return isSpecial2001 || normalized.startsWith("2001:db8") ||
      normalized.startsWith("2002:") || normalized.startsWith("3fff:");
  }
  return true;
}
