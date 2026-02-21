import React from "react";
import { draftMode } from "next/headers";
import { getPageBySlug } from "@lmnas/integrations";
import { PageRenderer } from "@lmnas/renderer";
import { buildSeo } from "@lmnas/seo-engine";

export default async function HomePage() {
  const preview = await draftMode();
  const page = await getPageBySlug("home", { preview: preview.isEnabled });
  const seo = buildSeo(page);

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>Hello Platform</h1>
      <p>Meta title: {seo.meta.title ?? "n/a"}</p>
      <PageRenderer blocks={page.blocks} preview={preview.isEnabled} />
    </main>
  );
}
