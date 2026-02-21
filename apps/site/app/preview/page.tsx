import React from "react";
import { notFound } from "next/navigation";
import { getPageBySlug, PageNotFoundError, StrapiUnreachableError } from "@lmnas/integrations";
import { LayoutRegistry } from "@lmnas/layouts";
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

function resolveExpectedPreviewSecret(): string | undefined {
  return process.env.PREVIEW_SECRET ?? process.env.STRAPI_PREVIEW_TOKEN ?? "local-preview-token";
}

export default async function PreviewPage({
  searchParams
}: {
  searchParams: Promise<Record<string, PreviewParamValue>>;
}) {
  const params = await searchParams;
  const slug = resolvePreviewSlug(params);
  const expected = resolveExpectedPreviewSecret();
  const providedToken = takeFirst(params.token) ?? takeFirst(params.secret);
  const tokenOk = Boolean(expected && providedToken && providedToken === expected);

  if (!tokenOk) {
    return <main>401 Invalid preview token.</main>;
  }

  let page;
  try {
    page = await getPageBySlug(slug, { preview: true });
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

  return (
    <Layout title={`preview:${page.layoutKey}`}>
      <main>
        <h1 style={{ marginTop: 0 }}>Preview: {slug}</h1>
        <PageRenderer blocks={page.blocks} preview />
      </main>
    </Layout>
  );
}
