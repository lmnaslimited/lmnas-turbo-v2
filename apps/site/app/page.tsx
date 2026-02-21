import React from "react";
import { getPageBySlug } from "@lmnas/integrations";
import { PageRenderer } from "@lmnas/renderer";
import { buildSeo } from "@lmnas/seo-engine";

export const conversionConfig = {
  primary: "book",
  product: "platform",
  industry: "healthcare"
} as const;

export default async function HomePage() {
  const page = await getPageBySlug("home", { preview: false });
  const seo = buildSeo(page);

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>Hello Platform</h1>
      <p>Meta title: {seo.meta.title ?? "n/a"}</p>
      <PageRenderer blocks={page.blocks} preview={false} />
    </main>
  );
}
