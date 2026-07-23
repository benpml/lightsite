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
  const [page, layout, home, frame, separator, falling, gravity, scene, noise, card, button, badge, globals, header, logo, navItem, utils] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/home/home-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/layout/section-frame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ui/separator.tsx", import.meta.url), "utf8"),
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
  assert.match(noise, /NOISE_TILE_SIZE = "256px 256px"/);
  assert.match(noise, /\/images\/home\/noise\.png/);
  assert.match(noise, /bg-top-left bg-repeat/);
  assert.match(noise, /className: "opacity-35 mix-blend-screen"/);
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
  assert.match(frame, /"pointer-events-none absolute inset-x-0 top-0 z-10"/);
  assert.match(frame, /topDividerClassName/);
  assert.match(frame, /function SectionCellDivider/);
  assert.match(frame, /variant="section"/);
  assert.doesNotMatch(frame, /<span[^>]+bg-border/);
  assert.match(frame, /<CornerDecoration/);
  assert.match(separator, /default: "bg-border"/);
  assert.match(separator, /section: "bg-section-divider"/);
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
  assert.match(gravity, /const spawnCeiling = Math\.min/);
  assert.match(falling, /email-avatar\.jpg/);
  assert.match(falling, /width=\{20\}/);
  assert.match(falling, /const fallSpacing = 175/);
  assert.match(falling, /kind: "email"[\s\S]*?spawnY: fallSpawnY\(5\)/);
  assert.match(falling, /kind: "file"[\s\S]*?spawnY: fallSpawnY\(6\)/);
  assert.match(falling, /page-document\.jpg/);
  assert.match(falling, /page-presentation\.jpg/);
  assert.match(falling, /page-folder\.jpg/);
  assert.match(falling, /width=\{22\}/);
  assert.equal(falling.match(/unoptimized/g)?.length, 2);
  assert.doesNotMatch(falling, /inertia: Number\.POSITIVE_INFINITY/);
  assert.match(falling, /w-max min-w-full/);
  assert.match(globals, /--text-17: 1\.0625rem/);
  assert.match(globals, /@utility text-body-item/);
  assert.match(falling, /whitespace-nowrap text-body-item/);
  assert.doesNotMatch(falling, /className="truncate/);
  assert.match(falling, /flex flex-col gap-2 text-body-item text-tertiary-foreground/);
  assert.match(card, /canvas: "bg-background ring-0"/);
  assert.doesNotMatch(home, /border-neutral-|bg-neutral-|text-neutral-/);
});

test("server-renders the monthly pricing page and preserves both billing states", async () => {
  const response = await render("/pricing");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<title>Pricing — Handout<\/title>/i);
  assert.match(html, /Pays for itself in more deals won\./);
  assert.match(html, /Monthly/);
  assert.match(html, /Annual/);
  assert.match(html, /\$49/);
  assert.match(html, /\$89/);

  const [pricing, tabs, badge, footer, frame, globals] = await Promise.all([
    readFile(new URL("../features/pricing/pricing-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ui/tabs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ui/badge.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/layout/site-footer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/layout/section-frame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(pricing, /monthlyPrice: "\$49"/);
  assert.match(pricing, /annualPrice: "\$39"/);
  assert.match(pricing, /monthlyPrice: "\$89"/);
  assert.match(pricing, /annualPrice: "\$72"/);
  assert.match(pricing, /<TabsContent value="monthly"/);
  assert.match(pricing, /<TabsContent value="annual"/);
  assert.match(pricing, /<Badge variant="success">Save 20%<\/Badge>/);
  assert.match(pricing, /<SiteHeader items=\{navigation\} width="full"/);
  assert.match(tabs, /rounded-full p-0\.5/);
  assert.match(tabs, /rounded-full border border-transparent/);
  assert.match(tabs, /data-active:border-border/);
  assert.match(badge, /success:[\s\S]*bg-success-background/);
  assert.match(globals, /--shadow-tab: var\(--tab-shadow\)/);
  assert.match(footer, /<SectionFrame/);
  assert.match(frame, /<SectionCellDivider|function SectionCellDivider/);
});

test("server-renders the legal documents and exposes them site-wide", async () => {
  const [privacyResponse, termsResponse, sitemapResponse] = await Promise.all([
    render("/privacy"),
    render("/terms"),
    render("/sitemap.xml"),
  ]);

  assert.equal(privacyResponse.status, 200);
  const privacyHtml = await privacyResponse.text();
  assert.match(privacyHtml, /<title>Privacy Policy — Handout<\/title>/i);
  assert.match(privacyHtml, /Visitors to customer-created sites/);
  assert.match(privacyHtml, /Session replay/);
  assert.match(privacyHtml, /Your privacy rights/);
  assert.match(privacyHtml, /Service providers and subprocessors/);
  assert.match(privacyHtml, /href="\/terms"/);

  assert.equal(termsResponse.status, 200);
  const termsHtml = await termsResponse.text();
  assert.match(termsHtml, /<title>Terms of Service — Handout<\/title>/i);
  assert.match(termsHtml, /Session Replay Addendum/);
  assert.match(termsHtml, /Data Processing Addendum/);
  assert.match(termsHtml, /Limitation of liability/);
  assert.match(termsHtml, /Standard Contractual Clauses/);
  assert.match(termsHtml, /href="\/privacy"/);

  assert.equal(sitemapResponse.status, 200);
  const sitemapXml = await sitemapResponse.text();
  assert.match(sitemapXml, /https:\/\/www\.handout\.link\/privacy/);
  assert.match(sitemapXml, /https:\/\/www\.handout\.link\/terms/);

  const footer = await readFile(
    new URL("../components/layout/site-footer.tsx", import.meta.url),
    "utf8",
  );
  assert.match(footer, /title: "Legal"/);
  assert.match(footer, /href: "\/privacy"/);
  assert.match(footer, /href: "\/terms"/);
});

test("server-renders the data-driven examples page", async () => {
  const response = await render("/examples");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<title>Examples — Handout<\/title>/i);
  assert.match(html, /Check out some Handout examples to get inspired\./);
  assert.match(html, /Start right now for free\./);
  assert.match(html, /View example/);
  assert.match(html, /\/images\/examples\/preview-gradient\.png/);

  const [page, content, card, cta, header, footer] = await Promise.all([
    readFile(new URL("../features/examples/examples-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/examples/examples-content.ts", import.meta.url), "utf8"),
    readFile(new URL("../features/examples/components/example-card.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/common/marketing-cta.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/layout/site-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/layout/site-footer.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /getPublishedExamples\(\)/);
  assert.match(page, /examples\.map\(\(example, index\)/);
  assert.equal((page.match(/<ExampleCard/g) ?? []).length, 1);
  assert.equal((content.match(/slug: "example-/g) ?? []).length, 6);
  assert.match(content, /status: "draft" \| "published"/);
  assert.match(content, /previewImage\?:/);
  assert.match(card, /min-h-\[416px\]/);
  assert.match(card, /h-64/);
  assert.match(card, /inset-x-4 top-4 bottom-0/);
  assert.match(card, /z-20 rounded-md ring-1 ring-inset ring-border/);
  assert.match(card, /<SectionCellDivider/);
  assert.match(card, /<Button asChild variant="secondary" size="lg" className="w-full">/);
  assert.match(cta, /min-h-\[497px\]/);
  assert.match(cta, /<Badge variant="inverse"/);
  assert.match(header, /href: "\/examples"/);
  assert.match(footer, /href: "\/examples"/);
  assert.doesNotMatch(`${page}${header}${footer}`, /\/#examples|href: "#examples"/);
});

test("server-renders the CMS-ready blog index and article pages", async () => {
  const indexResponse = await render("/blog");
  assert.equal(indexResponse.status, 200);

  const indexHtml = await indexResponse.text();
  assert.match(indexHtml, /<title>Blog — Handout<\/title>/i);
  assert.match(indexHtml, /Product announcements, sales insights, and practical guides\./);
  assert.match(indexHtml, /Introducing Handout/);
  assert.match(indexHtml, /Load more/);
  assert.match(indexHtml, /\/images\/blog\/post-cover\.jpg/);

  const articleResponse = await render("/blog/introducing-handout");
  assert.equal(articleResponse.status, 200);

  const articleHtml = await articleResponse.text();
  assert.match(articleHtml, /<title>Introducing Handout — Handout<\/title>/i);
  assert.match(articleHtml, /One link, built for the buyer/);
  assert.match(articleHtml, /All your sales materials in a single, trackable link\./);
  assert.match(articleHtml, /\/images\/blog\/post-noise\.png/);
  assert.match(articleHtml, /\/images\/blog\/post-cta-background\.png/);
  assert.match(articleHtml, /application\/ld\+json/);
  assert.match(articleHtml, /https:\/\/www\.handout\.link\/blog\/introducing-handout/);

  const [sitemapResponse, robotsResponse, rssResponse] = await Promise.all([
    render("/sitemap.xml"),
    render("/robots.txt"),
    render("/blog/rss.xml"),
  ]);
  assert.equal(sitemapResponse.status, 200);
  assert.match(await sitemapResponse.text(), /\/blog\/introducing-handout/);
  assert.equal(robotsResponse.status, 200);
  assert.match(await robotsResponse.text(), /Sitemap: https:\/\/www\.handout\.link\/sitemap\.xml/);
  assert.equal(rssResponse.status, 200);
  assert.match(rssResponse.headers.get("content-type") ?? "", /^application\/rss\+xml/i);
  assert.match(await rssResponse.text(), /<title>Handout Blog<\/title>/);

  const [page, content, grid, card, article, articleBody, articleCta, noise, route, sitemap, robots, rss, footer] =
    await Promise.all([
      readFile(new URL("../features/blog/blog-page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../features/blog/blog-content.ts", import.meta.url), "utf8"),
      readFile(new URL("../features/blog/components/blog-grid.tsx", import.meta.url), "utf8"),
      readFile(new URL("../features/blog/components/blog-card.tsx", import.meta.url), "utf8"),
      readFile(new URL("../features/blog/blog-post-page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../features/blog/components/article-body.tsx", import.meta.url), "utf8"),
      readFile(new URL("../features/blog/components/blog-post-cta.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/common/noise-overlay.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/blog/[slug]/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/robots.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/blog/rss.xml/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../components/layout/site-footer.tsx", import.meta.url), "utf8"),
    ]);

  assert.match(page, /getPublishedBlogPosts\(\)/);
  assert.match(page, /<BlogGrid posts=\{posts\}/);
  assert.match(content, /status: BlogPostStatus/);
  assert.match(content, /type BlogPostStatus = "draft" \| "published"/);
  assert.match(content, /seo: \{/);
  assert.match(content, /body: readonly BlogPostBlock\[\]/);
  assert.match(content, /function getBlogPost/);
  assert.match(content, /\.toSorted\(/);
  assert.equal((content.match(/definePost\(\{/g) ?? []).length, 12);
  assert.match(grid, /const INITIAL_POST_COUNT = 8/);
  assert.match(grid, /const POSTS_PER_LOAD = 4/);
  assert.match(grid, /variant="secondary"/);
  assert.match(grid, /size="lg"/);
  assert.match(grid, /You&apos;ve reached the end/);
  assert.match(grid, /text-center text-body-lg text-tertiary-foreground/);
  assert.match(card, /h-\[377px\]/);
  assert.match(card, /aspect-video/);
  assert.match(card, /rounded-md/);
  assert.match(card, /ring-1 ring-inset ring-border/);
  assert.match(card, /text-label-2xl/);
  assert.doesNotMatch(card, /truncate|line-clamp/);
  assert.match(card, /text-body-md text-neutral-500/);
  assert.match(article, /"@type": "BlogPosting"/);
  assert.match(article, /"@type": "BreadcrumbList"/);
  assert.match(article, /wordCount:/);
  assert.match(article, /max-w-\[699px\]/);
  assert.match(article, /h-\[139px\]/);
  assert.match(article, /aspect-video/);
  assert.match(articleBody, /text-title-md/);
  assert.match(articleBody, /text-title-sm/);
  assert.match(articleBody, /text-title-xs/);
  assert.match(articleBody, /text-body-xl text-tertiary-foreground/);
  assert.match(articleCta, /h-\[497px\]/);
  assert.match(articleCta, /post-cta-background\.png/);
  assert.match(articleCta, /<Logo[\s\S]*type="icon"[\s\S]*color="inverse"/);
  assert.match(articleCta, /<Button asChild variant="inverse" size="lg">/);
  assert.match(noise, /blog:[\s\S]*post-noise\.png[\s\S]*332\.5px 332\.5px/);
  assert.match(route, /generateStaticParams/);
  assert.match(route, /generateMetadata/);
  assert.match(route, /notFound\(\)/);
  assert.match(route, /"max-image-preview": "large"/);
  assert.match(sitemap, /getPublishedBlogPosts\(\)/);
  assert.match(robots, /sitemap: "https:\/\/www\.handout\.link\/sitemap\.xml"/);
  assert.match(rss, /application\/rss\+xml/);
  assert.match(footer, /href: "\/blog"/);
});

test("falls back to direct local images when optimizer bindings are unavailable", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("optimizer-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request(
      "http://localhost/_vinext/image?url=%2Fimages%2Fblog%2Fpost-cover.jpg&w=640&q=75",
    ),
    {},
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "http://localhost/images/blog/post-cover.jpg",
  );
});
