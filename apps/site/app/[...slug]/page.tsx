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
  const { isEnabled: isPreview } = await draftMode();
  const { slug: slugParts } = await params;
  const slug = resolveCmsSlug(slugParts);
  let page;
  try {
    page = await getPageBySlug(slug, { preview: isPreview });
  } catch (error) {
    if (error instanceof PageNotFoundError) {
      notFound();
    }
    if (error instanceof StrapiUnreachableError) {
      return <main>strapi_unreachable</main>;
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
        <PageRenderer blocks={page.blocks} preview={isPreview} />
      </main>
    </Layout>
  );
}
