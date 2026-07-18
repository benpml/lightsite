type BlogPostStatus = "draft" | "published"

type BlogPostCategory = "Announcements" | "Guides" | "Sales"

type BlogPostBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level?: 2 | 3 | 4; text: string }
  | { type: "list"; items: readonly string[] }
  | { type: "quote"; text: string }

type BlogPost = {
  slug: string
  title: string
  description: string
  excerpt: string
  publishedAt: string
  updatedAt?: string
  status: BlogPostStatus
  category: BlogPostCategory
  author: {
    name: string
  }
  image: {
    src: string
    alt: string
  }
  seo: {
    title?: string
    description: string
    keywords: readonly string[]
  }
  body: readonly BlogPostBlock[]
}

const defaultImage = {
  src: "/images/blog/post-cover.jpg",
  alt: "Layered green hills beneath a blue sky",
} as const

function definePost(post: BlogPost) {
  return post
}

const blogPosts = [
  definePost({
    slug: "introducing-handout",
    title: "Introducing Handout",
    description:
      "Meet the fastest way to turn sales collateral into a polished, trackable one pager.",
    excerpt:
      "Handout gives sales teams one clean link for every document, answer, and next step a buyer needs.",
    publishedAt: "2026-05-15T13:00:00.000Z",
    status: "published",
    category: "Announcements",
    author: { name: "The Handout team" },
    image: defaultImage,
    seo: {
      description:
        "Introducing Handout, the simple way to create polished, trackable sales one pagers for every prospect.",
      keywords: ["Handout", "sales one pager", "sales enablement"],
    },
    body: [
      {
        type: "paragraph",
        text: "Sales teams already have the material buyers need. The problem is that it lives across decks, PDFs, links, emails, and shared folders. Handout turns that scattered material into one focused page built for a specific conversation.",
      },
      { type: "heading", text: "One link, built for the buyer" },
      {
        type: "paragraph",
        text: "A Handout keeps the story clear without forcing a prospect to hunt through attachments. Add the right resources, personalize the message, and share a single link that works beautifully on any screen.",
      },
      {
        type: "list",
        items: [
          "Bring files, links, and key context together",
          "Personalize a page without rebuilding the source material",
          "See when a buyer returns and what earns attention",
        ],
      },
      {
        type: "quote",
        text: "The best follow-up is the one that makes the next decision easy.",
      },
    ],
  }),
  definePost({
    slug: "build-sales-one-pagers-faster",
    title: "Build sales one pagers faster",
    description:
      "A practical system for creating focused buyer experiences without duplicating work.",
    excerpt:
      "Use a repeatable content system to create better sales one pagers in minutes, not hours.",
    publishedAt: "2026-05-08T13:00:00.000Z",
    status: "published",
    category: "Guides",
    author: { name: "The Handout team" },
    image: defaultImage,
    seo: {
      description:
        "Learn how to build effective sales one pagers faster with a reusable, buyer-focused content workflow.",
      keywords: ["sales one pager", "sales collateral", "buyer enablement"],
    },
    body: [
      {
        type: "paragraph",
        text: "A strong one pager is not a compressed pitch deck. It is a guided path through the exact information one buyer needs to move forward.",
      },
      { type: "heading", text: "Start with the decision" },
      {
        type: "paragraph",
        text: "Before choosing content, write down the next decision you want the buyer to make. Every section should reduce uncertainty around that decision.",
      },
      {
        type: "list",
        items: [
          "Lead with the buyer's problem and desired outcome",
          "Include proof that matches their situation",
          "End with one clear next step",
        ],
      },
    ],
  }),
  definePost({
    slug: "track-buyer-engagement",
    title: "How to track buyer engagement",
    description:
      "Use engagement signals to follow up with better timing and more useful context.",
    excerpt:
      "A practical guide to reading buyer engagement without turning every view into noise.",
    publishedAt: "2026-05-01T13:00:00.000Z",
    status: "published",
    category: "Sales",
    author: { name: "The Handout team" },
    image: defaultImage,
    seo: {
      description:
        "Learn how sales teams can use buyer engagement signals to improve follow-up timing and relevance.",
      keywords: ["buyer engagement", "sales analytics", "sales follow-up"],
    },
    body: [
      {
        type: "paragraph",
        text: "Engagement data is most useful when it changes what you do next. A return visit, a shared link, or repeated attention on one resource can reveal where a deal needs clarity.",
      },
      { type: "heading", text: "Look for patterns, not pings" },
      {
        type: "paragraph",
        text: "One view rarely tells the whole story. Pay attention to repeat visits and meaningful sequences of activity, then use those signals to make your next conversation more relevant.",
      },
      {
        type: "list",
        items: [
          "Follow up on the resource that earned repeat attention",
          "Treat internal sharing as a cue to support a wider buying group",
          "Use inactivity as a reason to simplify the next step",
        ],
      },
    ],
  }),
  definePost({
    slug: "client-handout-checklist",
    title: "The client handout checklist",
    description:
      "The essential pieces every clear, useful post-call handout should include.",
    excerpt:
      "Use this checklist to make every client handout focused, credible, and easy to act on.",
    publishedAt: "2026-04-24T13:00:00.000Z",
    status: "published",
    category: "Guides",
    author: { name: "The Handout team" },
    image: defaultImage,
    seo: {
      description:
        "A concise checklist for creating client handouts that clarify value, answer questions, and move deals forward.",
      keywords: ["client handout", "sales follow-up", "sales collateral checklist"],
    },
    body: [
      {
        type: "paragraph",
        text: "The best client handouts feel specific even when the underlying material is reusable. They reflect what was discussed and make the next step obvious.",
      },
      { type: "heading", text: "What every handout needs" },
      {
        type: "list",
        items: [
          "A short recap in the buyer's language",
          "Only the proof and resources relevant to this deal",
          "Answers to the questions raised in the conversation",
          "One owner and one next step",
        ],
      },
    ],
  }),
  definePost({
    slug: "replace-attachment-pile-with-one-link",
    title: "Replace the attachment pile with one link",
    description:
      "Why a focused buyer page beats a long follow-up email full of disconnected files.",
    excerpt:
      "Give buyers one organized destination instead of making them manage your sales collateral.",
    publishedAt: "2026-04-17T13:00:00.000Z",
    status: "published",
    category: "Sales",
    author: { name: "The Handout team" },
    image: defaultImage,
    seo: {
      description:
        "Learn why replacing sales email attachments with one organized link creates a better buyer experience.",
      keywords: ["sales attachments", "digital sales room", "buyer experience"],
    },
    body: [
      {
        type: "paragraph",
        text: "Every extra attachment asks the buyer to do information architecture on your behalf. One organized destination keeps the context and the content together.",
      },
      { type: "heading", text: "Reduce the buyer's work" },
      {
        type: "paragraph",
        text: "A shared page is easier to revisit, easier to forward internally, and easier to keep current than a thread of increasingly outdated attachments.",
      },
    ],
  }),
  definePost({
    slug: "personalize-sales-content-with-ai-agents",
    title: "Personalize sales content with AI agents",
    description:
      "Give your agent a reliable way to assemble the right buyer-facing page for every prospect.",
    excerpt:
      "Connect reusable sales content to an agent-friendly publishing workflow without losing control.",
    publishedAt: "2026-04-10T13:00:00.000Z",
    status: "published",
    category: "Guides",
    author: { name: "The Handout team" },
    image: defaultImage,
    seo: {
      description:
        "Learn how AI agents can safely assemble and personalize sales content for individual prospects.",
      keywords: ["AI sales agent", "sales personalization", "agent workflow"],
    },
    body: [
      {
        type: "paragraph",
        text: "Agents are good at selecting and shaping information when the publishing surface is predictable. The key is to give them reusable content, clear constraints, and a structured output target.",
      },
      { type: "heading", text: "Keep the system composable" },
      {
        type: "list",
        items: [
          "Maintain approved source material",
          "Expose structured actions instead of brittle browser steps",
          "Review high-impact claims before publishing",
        ],
      },
    ],
  }),
  definePost({
    slug: "deal-rooms-without-the-bloat",
    title: "Deal rooms without the bloat",
    description:
      "A lightweight alternative for deals that need clarity, not another portal to manage.",
    excerpt:
      "Know when a focused handout is more useful than a fully loaded digital sales room.",
    publishedAt: "2026-04-03T13:00:00.000Z",
    status: "published",
    category: "Sales",
    author: { name: "The Handout team" },
    image: defaultImage,
    seo: {
      description:
        "Compare lightweight client handouts with digital sales rooms and choose the right experience for each deal.",
      keywords: ["digital sales room", "deal room", "buyer enablement"],
    },
    body: [
      {
        type: "paragraph",
        text: "Not every opportunity needs a portal, a project plan, and a dozen stakeholders. Many deals move faster with a focused page that answers the immediate questions well.",
      },
      { type: "heading", text: "Use the smallest useful experience" },
      {
        type: "paragraph",
        text: "Choose a lightweight handout when the buying motion is straightforward. Add process and collaboration only when the deal genuinely requires them.",
      },
    ],
  }),
  definePost({
    slug: "modern-sales-one-pager-checklist",
    title: "The modern sales one-pager checklist",
    description:
      "A simple framework for one pagers that are easy to scan, trust, share, and revisit.",
    excerpt:
      "Build a sales one pager around the buyer's decision, not your company's org chart.",
    publishedAt: "2026-03-27T13:00:00.000Z",
    status: "published",
    category: "Guides",
    author: { name: "The Handout team" },
    image: defaultImage,
    seo: {
      description:
        "Use this modern sales one-pager checklist to create focused, buyer-friendly collateral that drives action.",
      keywords: ["sales one pager checklist", "one pager template", "sales content"],
    },
    body: [
      {
        type: "paragraph",
        text: "Modern one pagers are living buyer experiences, not static company summaries. They should be easy to update, share, and understand without a sales rep in the room.",
      },
      { type: "heading", text: "Design for the second reader" },
      {
        type: "paragraph",
        text: "Assume your first contact will forward the page to someone who missed the call. Give that second reader enough context to understand why the conversation matters.",
      },
    ],
  }),
  definePost({
    slug: "write-better-post-call-follow-up",
    title: "Write a better post-call follow-up",
    description:
      "Turn a generic thank-you email into a useful continuation of the sales conversation.",
    excerpt:
      "A post-call follow-up framework that makes context and next steps easy to find.",
    publishedAt: "2026-03-20T13:00:00.000Z",
    status: "published",
    category: "Sales",
    author: { name: "The Handout team" },
    image: defaultImage,
    seo: {
      description:
        "Use this post-call sales follow-up framework to send clearer recaps, resources, and next steps.",
      keywords: ["post-call follow-up", "sales email", "sales recap"],
    },
    body: [
      {
        type: "paragraph",
        text: "A useful follow-up does more than prove you took notes. It preserves the logic of the conversation and helps the buyer continue it with other people.",
      },
      { type: "heading", text: "Write for forwarding" },
      {
        type: "list",
        items: [
          "Open with the outcome the buyer wants",
          "Recap the few details that change the recommendation",
          "Link to one organized destination",
          "Name the next step and its owner",
        ],
      },
    ],
  }),
  definePost({
    slug: "buyer-enablement-explained",
    title: "Buyer enablement, explained",
    description:
      "What buyer enablement means and how it differs from traditional sales enablement.",
    excerpt:
      "Shift from helping sellers present to helping buyers understand, align, and decide.",
    publishedAt: "2026-03-13T13:00:00.000Z",
    status: "published",
    category: "Guides",
    author: { name: "The Handout team" },
    image: defaultImage,
    seo: {
      description:
        "A straightforward explanation of buyer enablement and how it improves complex B2B purchase decisions.",
      keywords: ["buyer enablement", "sales enablement", "B2B buying"],
    },
    body: [
      {
        type: "paragraph",
        text: "Sales enablement helps sellers do their job. Buyer enablement helps the buying group do theirs: understand the problem, compare options, build consensus, and make a confident decision.",
      },
      { type: "heading", text: "Make the internal conversation easier" },
      {
        type: "paragraph",
        text: "The most valuable collateral is often the material your champion can use when you are not in the room.",
      },
    ],
  }),
  definePost({
    slug: "sales-collateral-content-audit",
    title: "Run a sales collateral content audit",
    description:
      "Find the content your team trusts, the gaps slowing deals down, and the files nobody uses.",
    excerpt:
      "A lightweight content audit for teams that want better reuse and less sales collateral sprawl.",
    publishedAt: "2026-03-06T13:00:00.000Z",
    status: "published",
    category: "Guides",
    author: { name: "The Handout team" },
    image: defaultImage,
    seo: {
      description:
        "Learn how to audit sales collateral, reduce content sprawl, and identify the resources deals actually need.",
      keywords: ["sales collateral audit", "content audit", "sales enablement"],
    },
    body: [
      {
        type: "paragraph",
        text: "Start with what sellers actually send, not what the content library says exists. Recent deal threads reveal which assets are trusted and where reps still improvise.",
      },
      { type: "heading", text: "Audit around buyer questions" },
      {
        type: "list",
        items: [
          "Collect the files and links used in recent deals",
          "Map each asset to the buyer question it answers",
          "Archive duplicates and outdated versions",
          "Prioritize gaps that repeatedly slow decisions",
        ],
      },
    ],
  }),
  definePost({
    slug: "share-sales-content-internally",
    title: "Help champions share sales content internally",
    description:
      "Create materials that survive the handoff from your call to the rest of the buying group.",
    excerpt:
      "Design sales content for the internal conversations your champion has after the meeting.",
    publishedAt: "2026-02-27T13:00:00.000Z",
    status: "published",
    category: "Sales",
    author: { name: "The Handout team" },
    image: defaultImage,
    seo: {
      description:
        "Learn how to create sales content that champions can confidently share with internal stakeholders.",
      keywords: ["sales champion", "buying committee", "sales content sharing"],
    },
    body: [
      {
        type: "paragraph",
        text: "Your champion should not have to recreate your pitch from memory. Give them a resource that explains the problem, the proposed path, and the proof in language their colleagues can understand.",
      },
      { type: "heading", text: "Make the page self-explanatory" },
      {
        type: "paragraph",
        text: "Remove meeting-specific shorthand, answer the obvious objections, and keep every supporting resource close to the claim it reinforces.",
      },
    ],
  }),
] satisfies readonly BlogPost[]

function getPublishedBlogPosts() {
  return blogPosts
    .filter((post) => post.status === "published")
    .toSorted(
      (first, second) =>
        Date.parse(second.publishedAt) - Date.parse(first.publishedAt),
    )
}

function getBlogPost(slug: string) {
  return getPublishedBlogPosts().find((post) => post.slug === slug)
}

function formatBlogPostDate(publishedAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(publishedAt))
}

export {
  blogPosts,
  formatBlogPostDate,
  getBlogPost,
  getPublishedBlogPosts,
  type BlogPost,
  type BlogPostBlock,
}
