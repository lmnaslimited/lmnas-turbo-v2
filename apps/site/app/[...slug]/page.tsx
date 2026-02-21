import React from "react";
import { draftMode } from "next/headers";
import { track } from "@lmnas/analytics";
import { getPageBySlug } from "@lmnas/integrations";
import { LayoutRegistry } from "@lmnas/layouts";
import { PageRenderer } from "@lmnas/renderer";
import { buildSeo } from "@lmnas/seo-engine";
import { resolveCmsSlug } from "../../lib/slug";

export default async function SlugPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug: slugParts } = await params;
  const slug = resolveCmsSlug(slugParts);
  const preview = await draftMode();
  const page = await getPageBySlug(slug, { preview: preview.isEnabled });
  const Layout = LayoutRegistry[page.layoutKey];
  const seo = buildSeo(page);

  track("page_view", { slug: page.slug, pageType: page.pageType });

  return (
    <Layout title={page.layoutKey}>
      <main>
        <h1 style={{ marginTop: 0 }}>{page.slug}</h1>
        <p>Meta title: {seo.meta.title ?? "n/a"}</p>
        <PageRenderer blocks={page.blocks} preview={preview.isEnabled} />
      </main>
    </Layout>
  );
}
