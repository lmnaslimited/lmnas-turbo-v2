import React from "react";
import { getPageBySlug } from "@lmnas/integrations";
import { PageRenderer } from "@lmnas/renderer";

export default async function PreviewPage({
  searchParams
}: {
  searchParams: Promise<{ slug?: string; token?: string }>;
}) {
  const params = await searchParams;
  const slug = params.slug ?? "home";
  const expected = process.env.STRAPI_PREVIEW_TOKEN;
  const tokenOk = !expected || !params.token || params.token === expected;

  if (!tokenOk) {
    return <main>Invalid preview token.</main>;
  }

  const page = await getPageBySlug(slug, { preview: true });

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>Preview: {slug}</h1>
      <PageRenderer blocks={page.blocks} preview />
    </main>
  );
}
