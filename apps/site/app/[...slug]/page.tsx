import React from "react";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { track } from "@lmnas/analytics";
import { getPageBySlug, PageNotFoundError, StrapiUnreachableError } from "@lmnas/integrations";
import { LayoutRegistry } from "@lmnas/layouts";
import { PageRenderer } from "@lmnas/renderer";
import { buildSeo } from "@lmnas/seo-engine";
import { resolveCmsSlug } from "../../lib/slug";

export default async function SlugPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug: slugParts } = await params;
  const slug = resolveCmsSlug(slugParts);
  const preview = await draftMode();
  let page;
  try {
    page = await getPageBySlug(slug, { preview: preview.isEnabled });
  } catch (error) {
    if (error instanceof PageNotFoundError) {
      notFound();
    }
    if (error instanceof StrapiUnreachableError) {
      throw new Error("strapi_unreachable");
    }
    throw error;
  }
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
