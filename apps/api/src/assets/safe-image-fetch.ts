import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { isBlockedAddress } from "../automations/destination";

const MAX_BYTES = 5_242_880;
const MAX_REDIRECTS = 3;
const CONNECT_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 15_000;

export class UnsafeAssetSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeAssetSourceError";
  }
}

export async function fetchSafeImage(rawUrl: string, redirectCount = 0): Promise<{
  content: Buffer;
  contentType: string;
  fileName: string;
  sourceHost: string;
}> {
  const url = parseSourceUrl(rawUrl);
  const addresses = await lookupWithTimeout(url.hostname);
  if (!addresses.length || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new UnsafeAssetSourceError("The image URL must resolve to a public internet address.");
  }
  const pinned = addresses[0]!;

  return new Promise((resolve, reject) => {
    let settled = false;
    let totalTimer: NodeJS.Timeout | undefined;
    const finish = (error?: Error, value?: { content: Buffer; contentType: string; fileName: string; sourceHost: string }) => {
      if (settled) return;
      settled = true;
      if (totalTimer) clearTimeout(totalTimer);
      error ? reject(error) : resolve(value!);
    };
    const request = httpsRequest({
      protocol: "https:",
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      servername: url.hostname,
      lookup(_hostname, _options, callback) {
        callback(null, pinned.address, pinned.family);
      },
      headers: {
        accept: "image/png,image/jpeg,image/webp",
        "accept-encoding": "identity",
        "user-agent": "Handout-Asset-Importer/1.0",
      },
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.destroy();
        if (redirectCount >= MAX_REDIRECTS) {
          finish(new UnsafeAssetSourceError("The image URL redirected too many times."));
          return;
        }
        const next = new URL(response.headers.location, url).toString();
        void fetchSafeImage(next, redirectCount + 1).then((value) => finish(undefined, value), finish);
        return;
      }
      if (status < 200 || status >= 300) {
        response.destroy();
        finish(new UnsafeAssetSourceError(`The image server returned HTTP ${status || "unknown"}.`));
        return;
      }
      const contentType = normalizeContentType(response.headers["content-type"]);
      if (!contentType) {
        response.destroy();
        finish(new UnsafeAssetSourceError("The URL must return a PNG, JPEG, or WebP image."));
        return;
      }
      const declaredSize = Number(response.headers["content-length"] ?? 0);
      if (declaredSize > MAX_BYTES) {
        response.destroy();
        finish(new UnsafeAssetSourceError("The image must be no larger than 5 MB."));
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer) => {
        total += chunk.byteLength;
        if (total > MAX_BYTES) {
          response.destroy(new UnsafeAssetSourceError("The image must be no larger than 5 MB."));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      response.on("end", () => {
        if (!total) {
          finish(new UnsafeAssetSourceError("The image response was empty."));
          return;
        }
        finish(undefined, {
          content: Buffer.concat(chunks),
          contentType,
          fileName: fileNameFromUrl(url, contentType),
          sourceHost: url.hostname,
        });
      });
      response.on("error", (error) => finish(error));
    });
    request.on("socket", (socket) => {
      socket.setTimeout(CONNECT_TIMEOUT_MS, () => request.destroy(new UnsafeAssetSourceError("The image server took too long to connect.")));
      socket.once("secureConnect", () => socket.setTimeout(0));
    });
    request.on("error", (error) => finish(error instanceof Error ? error : new Error(String(error))));
    totalTimer = setTimeout(() => request.destroy(new UnsafeAssetSourceError("The image import timed out.")), REQUEST_TIMEOUT_MS);
    totalTimer.unref();
    request.end();
  });
}

function parseSourceUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeAssetSourceError("Enter a valid public HTTPS image URL.");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const addressLiteral = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  if (url.protocol !== "https:" || !hostname || url.username || url.password || url.hash || url.port && url.port !== "443") {
    throw new UnsafeAssetSourceError("Use a public HTTPS image URL without credentials, fragments, or a custom port.");
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || isIP(addressLiteral) && isBlockedAddress(addressLiteral)) {
    throw new UnsafeAssetSourceError("The image URL must use a public host.");
  }
  url.hostname = hostname;
  return url;
}

async function lookupWithTimeout(hostname: string) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new UnsafeAssetSourceError("The image host took too long to resolve.")), CONNECT_TIMEOUT_MS);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeContentType(value: string | undefined) {
  const normalized = value?.split(";", 1)[0]?.trim().toLowerCase();
  return normalized === "image/png" || normalized === "image/jpeg" || normalized === "image/webp" ? normalized : null;
}

function fileNameFromUrl(url: URL, contentType: string) {
  const candidate = decodeURIComponent(url.pathname.split("/").pop() || "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 180);
  if (candidate && /\.(png|jpe?g|webp)$/i.test(candidate)) return candidate;
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return `imported-image.${extension}`;
}
