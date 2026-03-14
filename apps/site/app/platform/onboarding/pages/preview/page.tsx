import React from "react";
import { draftMode, headers } from "next/headers";
import { sanitizeHtmlToSafeMarkup } from "../../../../../lib/studio-html-sanitizer";
import type { StudioPageDocument } from "../../_lib/studio-types";
import PreviewClient from "./PreviewClient";

type PreviewPagePayload = {
  ok: boolean;
  data?: StudioPageDocument | null;
};

function ensureHtmlDocument(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return "<!doctype html><html><head></head><body></body></html>";
  }
  if (/<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body>${trimmed}</body></html>`;
}

function extractBodyHtml(input: string): string {
  const bodyMatch = input.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (typeof bodyMatch?.[1] === "string") {
    return bodyMatch[1];
  }
  return input;
}

function fallbackPreviewHtml(message: string): string {
  return [
    "<!doctype html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head>",
    "<body style=\"margin:0;background:#020617;color:#e2e8f0;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;\">",
    `<div style=\"text-align:center;padding:32px\"><h2 style=\"margin:0 0 8px;font-size:24px\">${message}</h2></div>`,
    "</body></html>"
  ].join("");
}

async function loadPreviewDocument(pageId: string, status: "draft" | "published"): Promise<PreviewPagePayload["data"]> {
  const headerBag = await headers();
  const host = headerBag.get("x-forwarded-host") ?? headerBag.get("host") ?? "127.0.0.1:3000";
  const protocol = headerBag.get("x-forwarded-proto") ?? (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const response = await fetch(`${protocol}://${host}/api/platform/studio/pages?id=${encodeURIComponent(pageId)}&status=${status}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as PreviewPagePayload;
  return payload.ok ? payload.data ?? null : null;
}

export default async function StudioPagePreview(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const searchParams = await props.searchParams;
  const pageId = typeof searchParams.pageId === "string" ? searchParams.pageId : "";
  const requestedStatus =
    typeof searchParams.previewStatus === "string" && (searchParams.previewStatus === "draft" || searchParams.previewStatus === "published")
      ? searchParams.previewStatus
      : null;
  const preview = await draftMode();
  const status = requestedStatus ?? (preview.isEnabled ? "draft" : "published");

  if (!pageId) {
    return <PreviewClient pageId="" pageName="Missing page id" status={status} html={fallbackPreviewHtml("Missing page id")} initialPreviewValid={false} />;
  }

  const page = await loadPreviewDocument(pageId, status);
  const sourceHtml = page?.previewHtml?.trim().length
    ? page.previewHtml
    : fallbackPreviewHtml(status === "draft" ? "Draft preview unavailable" : "Published preview unavailable");
  const html = ensureHtmlDocument(
    sanitizeHtmlToSafeMarkup(extractBodyHtml(ensureHtmlDocument(sourceHtml)), "https://lmnas.com/platform/onboarding/pages/preview")
  );
  return (
    <PreviewClient
      pageId={pageId}
      pageName={page?.name ?? "Studio page preview"}
      status={status}
      html={html}
      initialPreviewValid={Boolean(page?.previewValid)}
    />
  );
}
