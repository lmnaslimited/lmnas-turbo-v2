import React from "react";
import { draftMode, headers } from "next/headers";
import type { StudioBlockTemplate, StudioPageDocument, StudioShell, StudioTheme } from "../../_lib/studio-types";
import PreviewClient from "./PreviewClient";

type PreviewPagePayload = {
  ok: boolean;
  data?: StudioPageDocument | null;
};

type PreviewCollectionPayload<T> = {
  ok: boolean;
  data?: T[];
};

async function fetchJson<T>(href: string): Promise<T | null> {
  const response = await fetch(href, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
}

async function loadPreviewContext(params: {
  baseUrl: string;
  pageId: string;
  status: "draft" | "published";
}): Promise<{
  page: StudioPageDocument | null;
  blocks: StudioBlockTemplate[];
  shells: StudioShell[];
  themes: StudioTheme[];
}> {
  const [pagePayload, blocksPayload, shellsPayload, themesPayload] = await Promise.all([
    fetchJson<PreviewPagePayload>(`${params.baseUrl}/api/platform/studio/pages?id=${encodeURIComponent(params.pageId)}&status=${params.status}`),
    fetchJson<PreviewCollectionPayload<StudioBlockTemplate>>(`${params.baseUrl}/api/platform/studio/blocks`),
    fetchJson<PreviewCollectionPayload<StudioShell>>(`${params.baseUrl}/api/platform/studio/shells`),
    fetchJson<PreviewCollectionPayload<StudioTheme>>(`${params.baseUrl}/api/platform/studio/themes`)
  ]);

  return {
    page: pagePayload?.ok ? pagePayload.data ?? null : null,
    blocks: blocksPayload?.ok && Array.isArray(blocksPayload.data) ? blocksPayload.data : [],
    shells: shellsPayload?.ok && Array.isArray(shellsPayload.data) ? shellsPayload.data : [],
    themes: themesPayload?.ok && Array.isArray(themesPayload.data) ? themesPayload.data : []
  };
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
    return (
      <PreviewClient
        pageId=""
        pageName="Missing page id"
        status={status}
        page={null}
        blocks={[]}
        shells={[]}
        themes={[]}
        emptyTitle="Missing page id"
        initialPreviewValid={false}
      />
    );
  }

  const headerBag = await headers();
  const host = headerBag.get("x-forwarded-host") ?? headerBag.get("host") ?? "127.0.0.1:3000";
  const protocol = headerBag.get("x-forwarded-proto") ?? (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;
  const context = await loadPreviewContext({
    baseUrl,
    pageId,
    status
  });

  return (
    <PreviewClient
      pageId={pageId}
      pageName={context.page?.name ?? "Studio page preview"}
      status={status}
      page={context.page}
      blocks={context.blocks}
      shells={context.shells}
      themes={context.themes}
      emptyTitle={status === "draft" ? "Draft preview unavailable" : "Published preview unavailable"}
      initialPreviewValid={Boolean(context.page?.previewValid)}
    />
  );
}
