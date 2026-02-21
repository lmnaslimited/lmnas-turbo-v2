import React from "react";
import { redirect } from "next/navigation";

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
  const status = takeFirst(params.status)?.toLowerCase() === "published" ? "published" : "draft";

  if (!tokenOk) {
    return <main>401 Invalid preview token.</main>;
  }

  const token = providedToken as string;
  const previewUrl = new URL("/api/preview", "http://localhost");
  previewUrl.searchParams.set("slug", slug);
  previewUrl.searchParams.set("secret", token);
  previewUrl.searchParams.set("status", status);
  redirect(`${previewUrl.pathname}?${previewUrl.searchParams.toString()}`);
}
