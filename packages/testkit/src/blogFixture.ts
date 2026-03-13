import type { BlogPost } from "@lmnas/contracts";

export const blogPostFixture: BlogPost = {
  id: 1,
  slug: "phase-0-baseline",
  title: "Phase 0 Baseline Upgrade",
  excerpt: "How LMNAs aligned the scaffold with Constitution v2.1.",
  body: "Phase 0 baseline content.",
  seo: {
    metaTitle: "Phase 0 Baseline Upgrade",
    metaDescription: "How LMNAs aligned the scaffold with Constitution v2.1.",
    canonical: "https://lmnas.com/blogs/phase-0-baseline",
    robots: "index,follow"
  },
  publishedAt: "2026-01-01T00:00:00.000Z"
};
