import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Handout homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Handout — One pagers that close prospects<\/title>/i);
  assert.match(html, /Create one pagers that close prospects/);
  assert.match(html, /Why sales teams and prospects love it/);
  assert.match(html, /Let your agent build and personalize Handouts/);
  assert.match(html, /Start right now for free/);
  assert.match(html, /--neutral-450:#8d8d8d/);
  assert.match(html, /--border:var\(--neutral-alpha-a400\)/);
  assert.match(html, /\/scenes\/handout-hero\.json/);
  assert.match(html, /data-us-production="true"/);
  assert.match(html, /\/images\/home\/before\/email-avatar\.jpg/);
  assert.match(html, /\/images\/home\/before\/page-document\.jpg/);
  assert.match(html, /\/images\/home\/before\/page-presentation\.jpg/);
  assert.match(html, /\/images\/home\/before\/page-folder\.jpg/);
  assert.doesNotMatch(html, /_vinext\/image\?url=.*images%2Fhome%2Fbefore/);
  assert.doesNotMatch(html, /\/images\/home\/hero\.jpg/);
  assert.doesNotMatch(html, /Website foundation|Semantic color tokens/);
});

test("keeps homepage styling in canonical primitives and feature components", async () => {
  const [page, layout, home, frame, falling, gravity, scene, noise, card, button, badge, globals, header, logo, navItem, utils] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/home/home-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/home/components/section-frame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/home/components/falling-before.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/home/components/gravity.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/home/components/unicorn-hero-scene.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/common/noise-overlay.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ui/card.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ui/button.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ui/badge.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../components/layout/site-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/common/logo.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/layout/nav-item.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/utils.ts", import.meta.url), "utf8"),
  ]);

  assert.match(button, /variant:\s*\{[\s\S]*primary:[\s\S]*secondary:[\s\S]*ghost:[\s\S]*inverse:/);
  assert.match(button, /sm: "h-\[26px\]/);
  assert.match(button, /md: "h-\[31px\]/);
  assert.match(button, /lg: "h-\[35px\]/);
  assert.match(button, /text-label-md/);
  assert.match(button, /text-label-lg/);
  assert.match(button, /ring-1 ring-inset ring-border/);
  assert.doesNotMatch(button, /border-transparent|shadow-\[/);
  assert.match(badge, /h-\[27px\]/);
  assert.match(badge, /ring-1 ring-inset ring-border/);
  assert.doesNotMatch(badge, /rounded-full border|shadow-\[/);
  assert.match(globals, /--text-6xl: 3\.25rem/);
  assert.match(globals, /@utility text-title-xl/);
  assert.match(globals, /--shadow-control: var\(--control-shadow\)/);
  assert.doesNotMatch(globals, /repeating-radial-gradient|mix-blend-mode: soft-light/);
  assert.doesNotMatch(globals, /@keyframes handout-card-fall|--fall-delay/);
  assert.match(layout, /unicornstudio\.js@v2\.2\.8/);
  assert.match(layout, /<script[\s\S]*defer/);
  assert.match(scene, /data-us-project-src="\/scenes\/handout-hero\.json"/);
  assert.match(scene, /data-us-production="true"/);
  assert.match(scene, /data-us-fps="24"/);
  assert.match(noise, /FIGMA_NOISE_TILE_SIZE = "320px 320px"/);
  assert.match(noise, /\/images\/home\/noise\.webp/);
  assert.match(noise, /bg-top-left bg-repeat opacity-50 mix-blend-lighten/);
  assert.doesNotMatch(noise, /<canvas|ResizeObserver|feTurbulence/);
  assert.match(header, /size="md"/);
  assert.match(header, /ring-1 ring-inset ring-border/);
  assert.doesNotMatch(header, /border border-border/);
  assert.match(logo, /0 0 19 20/);
  assert.match(logo, /translate\(0 -0\.3743\)/);
  assert.doesNotMatch(navItem, /hover:bg-/);
  assert.match(utils, /extendTailwindMerge/);
  assert.match(utils, /"title-xl"/);
  assert.match(utils, /"label-lg"/);
  assert.match(page, /<HomePage \/>/);
  assert.match(home, /<SectionFrame/);
  assert.match(frame, /import \{ Separator \} from "@\/components\/ui\/separator"/);
  assert.match(frame, /<Separator className="pointer-events-none absolute inset-x-0 top-0" \/>/);
  assert.match(frame, /function SectionCellDivider/);
  assert.doesNotMatch(frame, /<span[^>]+bg-border/);
  assert.match(frame, /<CornerDecoration/);
  assert.match(falling, /IntersectionObserver/);
  assert.match(falling, /prefers-reduced-motion/);
  assert.match(falling, /<Gravity/);
  assert.match(falling, /<GravityBody/);
  assert.match(gravity, /from "matter-js"/);
  assert.match(gravity, /Bodies\.rectangle/);
  assert.match(gravity, /Mouse\.create/);
  assert.match(gravity, /MouseConstraint\.create/);
  assert.match(gravity, /Mouse\.clearSourceEvents/);
  assert.match(gravity, /removeEventListener\("wheel", mouse\.mousewheel\)/);
  assert.match(gravity, /touch-pan-y/);
  assert.match(gravity, /target\.closest\('\[data-gravity-draggable="true"\]'\)/);
  assert.match(gravity, /data-gravity-draggable/);
  assert.match(gravity, /Runner\.run/);
  assert.match(gravity, /ResizeObserver/);
  assert.match(falling, /email-avatar\.jpg/);
  assert.match(falling, /width=\{20\}/);
  assert.match(falling, /const fallDelayMs = 260/);
  assert.match(falling, /kind: "email"[\s\S]*?delayMs: fallDelay\(5\)/);
  assert.match(falling, /kind: "file"[\s\S]*?delayMs: fallDelay\(6\)/);
  assert.match(gravity, /bodyDelayTimersRef/);
  assert.match(gravity, /data-gravity-delay/);
  assert.match(falling, /page-document\.jpg/);
  assert.match(falling, /page-presentation\.jpg/);
  assert.match(falling, /page-folder\.jpg/);
  assert.match(falling, /width=\{22\}/);
  assert.equal(falling.match(/unoptimized/g)?.length, 2);
  assert.match(falling, /inertia: Number\.POSITIVE_INFINITY/);
  assert.match(falling, /w-max min-w-full/);
  assert.match(falling, /whitespace-nowrap text-body-2xl/);
  assert.doesNotMatch(falling, /className="truncate/);
  assert.match(falling, /flex flex-col gap-2 text-body-xl text-tertiary-foreground/);
  assert.match(card, /canvas: "bg-background ring-0"/);
  assert.doesNotMatch(home, /border-neutral-|bg-neutral-|text-neutral-/);
});
