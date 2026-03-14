"use client";

import React, { useEffect, useState } from "react";
import { requestClientJson } from "../../_lib/client-request";
import { publishPagePreviewAcceptance } from "../../_lib/page-preview-acceptance-channel";
import { evaluatePagePreviewAcceptance } from "../../_lib/page-validation";
import type { StudioPageDocument } from "../../_lib/studio-types";

type PreviewClientProps = {
  pageId: string;
  pageName: string;
  status: "draft" | "published";
  html: string;
  initialPreviewValid?: boolean;
};

type PageResponse = {
  ok: boolean;
  data?: StudioPageDocument | null;
  source?: "strapi" | "fallback";
  error?: string;
};

type SaveResponse = {
  ok: boolean;
  data?: {
    page?: StudioPageDocument;
  };
  source?: "strapi" | "fallback";
  error?: string;
};

export default function PreviewClient(props: PreviewClientProps): React.ReactElement {
  const [isReady, setIsReady] = useState(false);
  const [isAccepted, setIsAccepted] = useState(Boolean(props.initialPreviewValid));
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsReady(true);
  }, []);

  async function acceptPreview(): Promise<void> {
    setIsAccepting(true);
    setError(null);
    setStatusMessage(null);

    try {
      const pagePayload = await requestClientJson<PageResponse>(
        `/api/platform/studio/pages?id=${encodeURIComponent(props.pageId)}&status=draft`,
        {
          method: "GET",
          headers: { "content-type": "application/json" }
        },
        {
          timeoutMessage: "Loading the canonical draft page timed out. Please retry.",
          fallbackErrorMessage: "Unable to load the canonical draft page."
        }
      );

      if (!pagePayload.ok || !pagePayload.data) {
        throw new Error(pagePayload.error ?? "Unable to load the canonical draft page.");
      }
      if (pagePayload.source !== "strapi") {
        throw new Error("Preview acceptance requires canonical studio-pages from Strapi.");
      }

      const evaluation = evaluatePagePreviewAcceptance(pagePayload.data);
      if (!evaluation.previewValid) {
        throw new Error(evaluation.previewIssues.join(" "));
      }

      const savePayload = await requestClientJson<SaveResponse>(
        "/api/platform/studio/pages",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "preview-accept",
            pageId: props.pageId
          })
        },
        {
          timeoutMessage: "Accepting preview timed out. Please retry.",
          fallbackErrorMessage: "Unable to accept preview."
        }
      );

      if (!savePayload.ok || !savePayload.data?.page) {
        throw new Error(savePayload.error ?? "Unable to persist preview acceptance.");
      }
      if (savePayload.source !== "strapi") {
        throw new Error("Preview acceptance requires canonical studio-page persistence.");
      }

      publishPagePreviewAcceptance({
        pageId: savePayload.data.page.id,
        previewValid: true,
        seoJsonLdValid: evaluation.seoJsonLdValid
      });
      setIsAccepted(true);

      setStatusMessage(
        evaluation.seoJsonLdValid
          ? "Preview accepted. Preview valid and SEO / JSON-LD valid are now current."
          : `Preview accepted. SEO still requires attention: ${evaluation.seoIssues.join(" ")}`
      );
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : String(acceptError));
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#071226] text-slate-100" data-testid="studio-preview-page-root">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-white">Preview Workspace</p>
          <p className="text-[11px] text-slate-500">
            {props.pageName} · {props.status === "draft" ? "Draft preview" : "Published preview"}
          </p>
        </div>
        {props.status === "draft" ? (
          <button
            type="button"
            data-testid="preview-accept-button"
            onClick={() => {
              void acceptPreview();
            }}
            disabled={!isReady || isAccepting || isAccepted}
            className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {!isReady ? "Preparing…" : isAccepting ? "Accepting…" : isAccepted ? "Preview Accepted" : "Accept Preview"}
          </button>
        ) : (
          <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
            Published preview
          </div>
        )}
      </header>

      {error ? <div className="border-b border-red-500/30 bg-red-500/[0.08] px-5 py-3 text-xs text-red-300">{error}</div> : null}
      {statusMessage ? <div className="border-b border-emerald-500/30 bg-emerald-500/[0.08] px-5 py-3 text-xs text-emerald-300">{statusMessage}</div> : null}

      <main className="flex-1 p-4">
        <iframe
          title="studio-page-preview"
          data-testid="studio-page-preview-frame"
          className="h-[calc(100vh-120px)] w-full rounded-xl border border-white/[0.08] bg-white"
          srcDoc={props.html}
          sandbox="allow-scripts allow-same-origin"
        />
      </main>
    </div>
  );
}
