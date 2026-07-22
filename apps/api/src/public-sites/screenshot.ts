import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Browser, BrowserContext } from "playwright";
import { chromium } from "playwright";
import { normalizePublishedSitePayload } from "@handout/content-schema";
import {
  buildPublicPreviewVersion,
  HANDOUT_LOGO_MARK_PATH,
} from "@handout/site-document";
import { renderPublicSiteScreenshotHtmlDocument } from "./html";

export const PUBLIC_SITE_SCREENSHOT_WIDTH = 1200;
export const PUBLIC_SITE_SCREENSHOT_HEIGHT = 630;
export const PUBLIC_SITE_SCREENSHOT_CONTENT_TYPE = "image/jpeg";
export const PUBLIC_SITE_SCREENSHOT_CACHE_CONTROL = "no-store";
export const PUBLIC_SITE_SCREENSHOT_JPEG_QUALITY = 75;

const MAX_SCREENSHOT_CACHE_ENTRIES = 24;
const MAX_SCREENSHOT_CACHE_BYTES = 48 * 1024 * 1024;
const PAGE_RENDER_TIMEOUT_MS = 12_000;
const ASSET_SETTLE_TIMEOUT_MS = 3_000;

export type PublicSiteScreenshotRenderInput = {
  html: string;
  origin: string;
};

export interface PublicSiteScreenshotRenderer {
  close?(): Promise<void>;
  render(input: PublicSiteScreenshotRenderInput): Promise<Buffer>;
}

export interface PublicSiteScreenshotService {
  render(input: {
    origin: string;
    payload: Record<string, unknown>;
  }): Promise<{
    bytes: Buffer;
    cacheKey: string;
  } | null>;
}

export function getPublicSiteScreenshotCacheKey(payload: Record<string, unknown>) {
  const normalized = normalizePublishedSitePayload(payload);
  if (!normalized) return null;

  return [
    `jpg-q${PUBLIC_SITE_SCREENSHOT_JPEG_QUALITY}`,
    normalized.workspace.id,
    normalized.site.id,
    buildPublicPreviewVersion(normalized),
    normalized.selectedVariant?.id ?? "default",
  ].join(":");
}

export function createPublicSiteScreenshotService(
  renderer: PublicSiteScreenshotRenderer = createPlaywrightPublicSiteScreenshotRenderer(),
): PublicSiteScreenshotService {
  const cache = new Map<string, Buffer>();
  const inFlight = new Map<string, Promise<Buffer>>();
  let cacheBytes = 0;

  return {
    async render(input) {
      const payload = normalizePublishedSitePayload(input.payload);
      const html = renderPublicSiteScreenshotHtmlDocument(input);

      if (!payload || !html) {
        return null;
      }

      const cacheKey = getPublicSiteScreenshotCacheKey(input.payload);
      if (!cacheKey) return null;
      const cached = cache.get(cacheKey);

      if (cached) {
        cache.delete(cacheKey);
        cache.set(cacheKey, cached);
        return { bytes: cached, cacheKey };
      }

      let pending = inFlight.get(cacheKey);
      if (!pending) {
        pending = renderer.render({ html, origin: input.origin });
        inFlight.set(cacheKey, pending);
      }

      try {
        const bytes = await pending;
        if (bytes.byteLength <= MAX_SCREENSHOT_CACHE_BYTES) {
          cache.set(cacheKey, bytes);
          cacheBytes += bytes.byteLength;
        }
        while (cache.size > MAX_SCREENSHOT_CACHE_ENTRIES || cacheBytes > MAX_SCREENSHOT_CACHE_BYTES) {
          const oldestKey = cache.keys().next().value;
          if (typeof oldestKey !== "string") break;
          cacheBytes -= cache.get(oldestKey)?.byteLength ?? 0;
          cache.delete(oldestKey);
        }
        return { bytes, cacheKey };
      } finally {
        inFlight.delete(cacheKey);
      }
    },
  };
}

export function createPlaywrightPublicSiteScreenshotRenderer(): PublicSiteScreenshotRenderer {
  let browserPromise: Promise<Browser> | null = null;
  const acquireRenderSlot = createAsyncSemaphore(2);

  const getBrowser = () => {
    browserPromise ??= chromium.launch({
      headless: true,
      args: [
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-dev-shm-usage",
        "--disable-sync",
        "--no-sandbox",
      ],
    });
    return browserPromise;
  };

  return {
    async close() {
      const browser = await browserPromise;
      browserPromise = null;
      await browser?.close();
    },
    async render(input) {
      const releaseRenderSlot = await acquireRenderSlot();
      let browser: Browser | null = null;
      let context: BrowserContext | null = null;

      try {
        browser = await getBrowser();
        context = await browser.newContext({
          colorScheme: "light",
          deviceScaleFactor: 1,
          locale: "en-US",
          reducedMotion: "reduce",
          viewport: {
            width: PUBLIC_SITE_SCREENSHOT_WIDTH,
            height: PUBLIC_SITE_SCREENSHOT_HEIGHT,
          },
        });
        const page = await context.newPage();
        await page.route("**/*", async (route) => {
          if (await isAllowedScreenshotResourceUrl(route.request().url(), input.origin)) {
            await route.continue();
          } else {
            await route.abort("blockedbyclient");
          }
        });
        await page.goto(new URL("/api/health", input.origin).toString(), {
          timeout: PAGE_RENDER_TIMEOUT_MS,
          waitUntil: "domcontentloaded",
        });
        await page.setContent(withBaseHref(input.html, input.origin), {
          timeout: PAGE_RENDER_TIMEOUT_MS,
          waitUntil: "load",
        });
        await page.evaluate(async ({ timeoutMs, workspaceFallbackPath }) => {
          const assetsReady = Promise.all([
            document.fonts?.ready ?? Promise.resolve(),
            ...Array.from(document.images).map((image) => image.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  image.addEventListener("load", () => resolve(), { once: true });
                  image.addEventListener("error", () => resolve(), { once: true });
                })),
          ]);
          await Promise.race([
            assetsReady,
            new Promise((resolve) => window.setTimeout(resolve, timeoutMs)),
          ]);
          const removeLogoTile = (image: HTMLImageElement) => {
            const tile = image.closest('.handout-page-title-logo');
            const group = tile?.parentElement;
            tile?.remove();
            if (group && !group.querySelector('.handout-page-title-logo')) group.remove();
          };
          const waitForImage = (image: HTMLImageElement) => image.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                image.addEventListener("load", () => resolve(), { once: true });
                image.addEventListener("error", () => resolve(), { once: true });
              });
          const workspaceFallbacks: HTMLImageElement[] = [];

          document.querySelectorAll<HTMLImageElement>('.handout-page-title-logo img')
            .forEach((image) => {
              if (image.naturalWidth > 0) return;
              const tile = image.closest('.handout-page-title-logo');
              if (tile?.getAttribute('data-handout-logo-kind') !== 'workspace') {
                removeLogoTile(image);
                return;
              }
              image.alt = "Handout";
              image.src = workspaceFallbackPath;
              workspaceFallbacks.push(image);
            });

          if (workspaceFallbacks.length) {
            await Promise.race([
              Promise.all(workspaceFallbacks.map(waitForImage)),
              new Promise((resolve) => window.setTimeout(resolve, timeoutMs)),
            ]);
            workspaceFallbacks.forEach((image) => {
              if (image.naturalWidth === 0) removeLogoTile(image);
            });
          }
          window.scrollTo(0, 0);
        }, {
          timeoutMs: ASSET_SETTLE_TIMEOUT_MS,
          workspaceFallbackPath: HANDOUT_LOGO_MARK_PATH,
        });

        return await page.screenshot({
          animations: "disabled",
          caret: "hide",
          fullPage: false,
          quality: PUBLIC_SITE_SCREENSHOT_JPEG_QUALITY,
          type: "jpeg",
        });
      } catch (error) {
        if (browser && !browser.isConnected()) {
          browserPromise = null;
        }
        throw error;
      } finally {
        try {
          await context?.close();
        } finally {
          releaseRenderSlot();
        }
      }
    },
  };
}

function createAsyncSemaphore(limit: number) {
  let active = 0;
  const waiters: Array<() => void> = [];

  return async () => {
    if (active >= limit) {
      await new Promise<void>((resolve) => waiters.push(resolve));
    }
    active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      active -= 1;
      waiters.shift()?.();
    };
  };
}

function withBaseHref(html: string, origin: string) {
  const base = `<base href="${escapeHtmlAttribute(new URL("/", origin).toString())}">`;
  return html.replace("<head>", `<head>${base}`);
}

async function isAllowedScreenshotResourceUrl(value: string, origin: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (["about:", "blob:", "data:"].includes(url.protocol)) return true;
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.origin === new URL(origin).origin) return true;
  if (url.protocol !== "https:") return false;

  try {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every(({ address }) => isPublicIpAddress(address));
  } catch {
    return false;
  }
}

export function isPublicIpAddress(address: string) {
  const version = isIP(address);
  if (version === 4) {
    const [a = 0, b = 0] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    return !(
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:169.254.") ||
      normalized.startsWith("::ffff:172.") ||
      normalized.startsWith("::ffff:192.168.")
    );
  }
  return false;
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
