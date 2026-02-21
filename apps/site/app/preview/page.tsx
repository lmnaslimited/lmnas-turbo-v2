import React from "react";
import { getPageBySlug } from "@lmnas/integrations";
import { PageRenderer } from "@lmnas/renderer";

type PreviewParamValue = string | string[] | undefined;

function takeFirst(value: PreviewParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function normalizeSlug(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = new URL(trimmed, "http://localhost");
  const slugFromQuery = parsed.searchParams.get("slug");
  if (slugFromQuery) {
    return normalizeSlug(slugFromQuery);
  }

  const normalized = decodeURIComponent(parsed.pathname).replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized === "preview") {
    return undefined;
  }

  return normalized;
}

function resolvePreviewSlug(params: Record<string, PreviewParamValue>): string {
  const candidates = [
    takeFirst(params.slug),
    takeFirst(params.path),
    takeFirst(params.pathname),
    takeFirst(params.url)
  ];

  for (const candidate of candidates) {
    const slug = normalizeSlug(candidate);
    if (slug) {
      return slug;
    }
  }

  return "home";
}

export default async function PreviewPage({
  searchParams
}: {
  searchParams: Promise<Record<string, PreviewParamValue>>;
}) {
  const params = await searchParams;
  const slug = resolvePreviewSlug(params);
  const expected = process.env.STRAPI_PREVIEW_TOKEN;
  const providedToken = takeFirst(params.token) ?? takeFirst(params.secret);
  const tokenOk = !expected || !providedToken || providedToken === expected;

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
