"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { requestClientJson } from "../_lib/client-request";
import {
  buildPlatformBlockPreviewDocument,
  buildPreviewThumbnailDocument,
  usePlatformPreviewAssets
} from "../_lib/platform-preview";
import { readPreviewSwatchThemeId, setPreviewSwatchThemeId as setGlobalPreviewSwatchThemeId, subscribePreviewSwatchThemeId } from "../_lib/preview-swatch-state";
import type { StudioBlockTemplate, StudioPageDocument, StudioTheme } from "../_lib/studio-types";
import { renderCanonicalBlockMarkup } from "../../../../lib/studio-canonical";

type BlocksResponse = {
  ok: boolean;
  data?: StudioBlockTemplate[];
  source?: "strapi" | "fallback";
  schemaSource?: "canonical" | "legacy" | "fallback";
  error?: string;
  code?: string;
  whereUsed?: Array<{ id: string; slug: string; locale: string }>;
};

type PreviewDevice = "desktop" | "tablet" | "mobile";
type BlockPreviewVariant = "target" | "source";
type BlockMenuAction = "toggle-status" | "duplicate" | "delete";

type ThemesResponse = {
  ok: boolean;
  data?: StudioTheme[];
  source?: "strapi" | "fallback";
  schemaSource?: "canonical" | "legacy" | "fallback";
  error?: string;
};

const STATUS_OPTIONS: Array<StudioBlockTemplate["status"]> = ["draft", "active", "inactive"];

function canonicalGuard(payload: BlocksResponse, fallbackMessage: string): asserts payload is Required<Pick<BlocksResponse, "ok" | "data" | "source" | "schemaSource">> {
  if (!payload.ok || !Array.isArray(payload.data)) {
    throw new Error(payload.error ?? fallbackMessage);
  }
  if (payload.source !== "strapi" || payload.schemaSource !== "canonical") {
    throw new Error("Blocks page requires canonical studio-blocks from Strapi. Legacy/fallback source detected.");
  }
}

function schemaBadgeTone(schemaStatus: StudioBlockTemplate["schemaStatus"]): string {
  if (schemaStatus === "valid") {
    return "border-emerald-500/30 bg-emerald-500/[0.12] text-emerald-200";
  }
  if (schemaStatus === "warning") {
    return "border-amber-500/30 bg-amber-500/[0.12] text-amber-200";
  }
  return "border-red-500/30 bg-red-500/[0.12] text-red-200";
}

function lifecycleBadgeTone(value: StudioBlockTemplate["lifecycle"]): string {
  if (value === "published") {
    return "border-blue-500/30 bg-blue-500/[0.12] text-blue-200";
  }
  if (value === "archived") {
    return "border-slate-500/30 bg-slate-500/[0.12] text-slate-300";
  }
  return "border-violet-500/30 bg-violet-500/[0.12] text-violet-200";
}

function scopeBadgeTone(value: StudioBlockTemplate["scope"]): string {
  if (value === "page-local") {
    return "border-orange-500/30 bg-orange-500/[0.12] text-orange-200";
  }
  return "border-cyan-500/30 bg-cyan-500/[0.12] text-cyan-200";
}

function stripScriptTags(input: string): string {
  return input.replace(/<script[\s\S]*?<\/script>/gi, "");
}

function sanitizePreviewHtml(input: string): string {
  return stripScriptTags(input)
    .replace(/<link[^>]+href=["']https?:\/\/[^"']+["'][^>]*>/gi, "")
    .replace(/\s(?:src|href)=["']https?:\/\/[^"']+["']/gi, "");
}

function tokenValue(theme: StudioTheme, matchers: string[], fallback: string): string {
  const token = theme.tokens.find((entry) => matchers.some((matcher) => entry.key.toLowerCase().includes(matcher)));
  return token?.value ?? fallback;
}

function themeSwatchGradient(theme: StudioTheme): string {
  const primary = tokenValue(theme, ["primary", "accent"], theme.darkMode ? "#2563eb" : "#0f172a");
  const background = tokenValue(theme, ["background", "surface", "bg"], theme.darkMode ? "#020617" : "#e2e8f0");
  const muted = tokenValue(theme, ["muted", "secondary"], theme.darkMode ? "#334155" : "#94a3b8");
  return `linear-gradient(135deg, ${background} 0%, ${primary} 62%, ${muted} 100%)`;
}

export default function BlocksWorkflowPage(): React.ReactElement {
  const platformPreviewAssets = usePlatformPreviewAssets();
  const [blocks, setBlocks] = useState<StudioBlockTemplate[]>([]);
  const [pages, setPages] = useState<StudioPageDocument[]>([]);
  const [themes, setThemes] = useState<StudioTheme[]>([]);
  const [previewSwatchThemeId, setPreviewSwatchThemeId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [previewVariant, setPreviewVariant] = useState<BlockPreviewVariant>("target");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingBlockId, setRenamingBlockId] = useState<string | null>(null);
  const [inlineBlockName, setInlineBlockName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void loadBlocks("");
    void loadPages();
    void loadThemes();
    setPreviewSwatchThemeId(readPreviewSwatchThemeId());
  }, []);

  useEffect(() => {
    return subscribePreviewSwatchThemeId((themeId) => {
      setPreviewSwatchThemeId(themeId);
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (!menuRef.current) {
        return;
      }
      if (event.target instanceof Node && menuRef.current.contains(event.target)) {
        return;
      }
      setOpenMenuId(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadBlocks(query: string): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const searchQuery = query.trim();
      const suffix = searchQuery.length > 0 ? `?search=${encodeURIComponent(searchQuery)}` : "";
      const payload = await requestClientJson<BlocksResponse>(
        `/api/platform/studio/blocks${suffix}`,
        {
          method: "GET",
          headers: { "content-type": "application/json" }
        },
        {
          timeoutMessage: "Loading canonical blocks timed out. Please retry.",
          fallbackErrorMessage: "Unable to load blocks."
        }
      );

      canonicalGuard(payload, "Unable to load blocks.");
      setBlocks(payload.data);
      setSelectedId((current) => current ?? payload.data[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setBlocks([]);
      setSelectedId(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPages(): Promise<void> {
    try {
      const payload = await requestClientJson<{
        ok: boolean;
        data?: StudioPageDocument[];
        source?: "strapi" | "fallback";
        error?: string;
      }>(
        "/api/platform/studio/pages",
        {
          method: "GET",
          headers: { "content-type": "application/json" }
        },
        {
          timeoutMessage: "Loading page references timed out. Please retry.",
          fallbackErrorMessage: "Unable to load page references."
        }
      );

      if (!payload.ok || !Array.isArray(payload.data)) {
        throw new Error(payload.error ?? "Unable to load pages.");
      }
      if (payload.source !== "strapi") {
        throw new Error("Page references require canonical studio-pages from Strapi.");
      }
      setPages(payload.data);
    } catch {
      setPages([]);
    }
  }

  async function loadThemes(): Promise<void> {
    try {
      const payload = await requestClientJson<ThemesResponse>(
        "/api/platform/studio/themes",
        {
          method: "GET",
          headers: { "content-type": "application/json" }
        },
        {
          timeoutMessage: "Loading themes timed out. Please retry.",
          fallbackErrorMessage: "Unable to load themes."
        }
      );

      if (!payload.ok || !Array.isArray(payload.data)) {
        throw new Error(payload.error ?? "Unable to load themes.");
      }
      if (payload.source !== "strapi" || payload.schemaSource !== "canonical") {
        throw new Error("Blocks page requires canonical studio-themes from Strapi.");
      }
      setThemes(payload.data);
    } catch {
      setThemes([]);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length === 0) {
      return blocks;
    }
    return blocks.filter((block) => `${block.name} ${block.family} ${block.key}`.toLowerCase().includes(q));
  }, [blocks, search]);

  const selected = useMemo(() => filtered.find((entry) => entry.id === selectedId) ?? filtered[0] ?? null, [filtered, selectedId]);
  const activeTheme = useMemo(() => themes.find((theme) => theme.status === "active") ?? themes[0] ?? null, [themes]);
  const previewTheme = useMemo(
    () => themes.find((theme) => theme.id === previewSwatchThemeId) ?? activeTheme,
    [activeTheme, previewSwatchThemeId, themes]
  );

  const blockUsage = useMemo(() => {
    const map = new Map<string, number>();
    pages.forEach((page) => {
      page.blockOrder.forEach((blockKey) => {
        map.set(blockKey, (map.get(blockKey) ?? 0) + 1);
      });
    });
    return map;
  }, [pages]);

  const whereUsedPages = useMemo(() => {
    if (!selected) {
      return [] as StudioPageDocument[];
    }
    return pages.filter((page) => page.blockOrder.includes(selected.key) || page.blockOrder.includes(selected.id));
  }, [pages, selected]);

  function patchSelected(next: Partial<StudioBlockTemplate>): void {
    if (!selected) {
      return;
    }
    setBlocks((current) =>
      current.map((entry) =>
        entry.id === selected.id
          ? {
              ...entry,
              ...next,
              updatedAt: new Date().toISOString().slice(0, 10)
            }
          : entry
      )
    );
  }

  function startInlineRename(block: StudioBlockTemplate): void {
    setSelectedId(block.id);
    setRenamingBlockId(block.id);
    setInlineBlockName(block.name);
    setOpenMenuId(null);
    setError(null);
    setStatusMessage(null);
  }

  function cancelInlineRename(): void {
    setRenamingBlockId(null);
    setInlineBlockName("");
  }

  async function commitInlineRename(block: StudioBlockTemplate): Promise<void> {
    const trimmedName = inlineBlockName.trim();
    if (trimmedName.length === 0) {
      setError("Block name is required.");
      return;
    }
    if (trimmedName === block.name) {
      cancelInlineRename();
      return;
    }

    setIsMutating(true);
    setError(null);
    setStatusMessage(null);

    try {
      await persistBlock(
        {
          ...block,
          name: trimmedName
        },
        `Renamed ${block.name} to ${trimmedName}.`
      );
      cancelInlineRename();
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : String(renameError));
    } finally {
      setIsMutating(false);
    }
  }

  async function persistBlock(block: StudioBlockTemplate, successMessage: string): Promise<void> {
    const payload = await requestClientJson<BlocksResponse>(
      "/api/platform/studio/blocks",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ block })
      },
      {
        timeoutMessage: "Saving canonical block timed out. Please retry.",
        fallbackErrorMessage: "Unable to save canonical block."
      }
    );

    canonicalGuard(payload, "Unable to save canonical block.");
    setBlocks(payload.data);
    const persisted = payload.data.find((entry) => entry.key === block.key) ?? payload.data.find((entry) => entry.id === block.id);
    setSelectedId(persisted?.id ?? block.id);
    setStatusMessage(successMessage);
    setError(null);
  }

  async function saveSelected(): Promise<void> {
    if (!selected) {
      return;
    }

    setIsMutating(true);
    setStatusMessage(null);
    setError(null);
    try {
      await persistBlock(selected, `Saved canonical block ${selected.name}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsMutating(false);
    }
  }

  async function runBlockAction(action: BlockMenuAction, block: StudioBlockTemplate): Promise<void> {
    setIsMutating(true);
    setError(null);
    setStatusMessage(null);

    try {
      if (action === "toggle-status") {
        const nextStatus: StudioBlockTemplate["status"] = block.status === "active" ? "inactive" : "active";
        await persistBlock(
          {
            ...block,
            status: nextStatus
          },
          `${block.name} is now ${nextStatus}.`
        );
      }

      if (action === "duplicate") {
        const suffix = Date.now().toString().slice(-6);
        const duplicateKey = `${block.key}-copy-${suffix}`;
        const duplicate: StudioBlockTemplate = {
          ...block,
          id: `dup-${duplicateKey}`,
          key: duplicateKey,
          name: `${block.name} Copy`,
          lifecycle: "draft",
          status: "draft",
          usageCount: 0,
          inUseCount: 0,
          updatedAt: new Date().toISOString().slice(0, 10)
        };
        await persistBlock(duplicate, `Duplicated ${block.name} as ${duplicate.name}.`);
        setSelectedId(duplicate.id);
      }

      if (action === "delete") {
        const response = await requestClientJson<BlocksResponse>(
          `/api/platform/studio/blocks?key=${encodeURIComponent(block.key)}`,
          {
            method: "DELETE",
            headers: { "content-type": "application/json" }
          },
          {
            timeoutMessage: "Deleting canonical block timed out. Please retry.",
            fallbackErrorMessage: "Unable to delete canonical block."
          }
        );

        if (!response.ok) {
          const whereUsedList = Array.isArray(response.whereUsed)
            ? response.whereUsed.map((entry) => entry.slug).join(", ")
            : "";
          const whereUsedMessage = whereUsedList.length > 0 ? ` Referenced by: ${whereUsedList}.` : "";
          throw new Error((response.error ?? "Unable to delete block.") + whereUsedMessage);
        }

        canonicalGuard(response, "Unable to delete canonical block.");
        setBlocks(response.data);
        setSelectedId((current) => {
          if (!current) {
            return response.data[0]?.id ?? null;
          }
          const stillExists = response.data.some((entry) => entry.id === current);
          return stillExists ? current : response.data[0]?.id ?? null;
        });
        setStatusMessage(`Deleted ${block.name}.`);
      }

      await loadPages();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError));
    } finally {
      setOpenMenuId(null);
      setIsMutating(false);
    }
  }

  function deviceFrameClass(): string {
    if (previewDevice === "tablet") {
      return "mx-auto h-[420px] w-[740px] max-w-full";
    }
    if (previewDevice === "mobile") {
      return "mx-auto h-[460px] w-[320px] max-w-full";
    }
    return "h-[420px] w-full";
  }

  const selectedUsageCount = selected ? blockUsage.get(selected.key) ?? blockUsage.get(selected.id) ?? selected.usageCount ?? selected.inUseCount : 0;

  function resolveTargetPreview(block: StudioBlockTemplate): string {
    const proposalHtml = block ? renderCanonicalBlockMarkup(block).bodyHtml.trim() : "";
    if (proposalHtml.length === 0) {
      return "";
    }
    return buildPlatformBlockPreviewDocument({
      proposalHtml,
      theme: previewTheme,
      hostAssets: platformPreviewAssets
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4" data-testid="blocks-workspace">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Reusable Blocks</h1>
          <p className="mt-1 text-xs text-slate-500">Manage and edit your library of reusable content blocks.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-2 flex items-center gap-2 border-r border-white/[0.1] pr-4">
            <div className="flex -space-x-1.5">
              {themes.slice(0, 5).map((theme) => {
                const selected = previewSwatchThemeId === theme.id || (!previewSwatchThemeId && activeTheme?.id === theme.id);
                return (
                  <button
                    key={theme.id}
                    type="button"
                    data-testid={`blocks-theme-swatch-${theme.id}`}
                    onClick={() => {
                      const nextId = previewSwatchThemeId === theme.id ? null : theme.id;
                      setGlobalPreviewSwatchThemeId(nextId);
                    }}
                    className={`h-5 w-5 rounded-full border-2 border-[#071226] ${selected ? "ring-2 ring-blue-500/40" : ""}`}
                    style={{ background: themeSwatchGradient(theme) }}
                    title={`Preview ${theme.name}`}
                  />
                );
              })}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {previewTheme ? `Theme · ${previewTheme.name}` : "Theme"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!selected) {
                return;
              }
              void runBlockAction("duplicate", selected);
            }}
            className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500/90"
          >
            <span className="material-symbols-outlined mr-1 align-middle text-[16px]">add</span>
            New Block
          </button>
        </div>
      </header>

      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs text-red-300">{error}</div> : null}
      {statusMessage ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-2 text-xs text-emerald-300">{statusMessage}</div>
      ) : null}

      <div className="min-h-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081327]">
        <div className="grid min-h-[72vh] gap-0 xl:grid-cols-[430px_minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col border-b border-white/[0.08] bg-[#071226] xl:border-b-0 xl:border-r">
            <div className="border-b border-white/[0.08] p-3">
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-2.5 text-[18px] text-slate-500">search</span>
                <input
                  data-testid="blocks-search-input"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void loadBlocks(search);
                    }
                  }}
                  placeholder="Search blocks..."
                  className="w-full rounded-lg border border-white/[0.1] bg-white/[0.03] py-2 pl-9 pr-3 text-xs text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {isLoading ? <p className="px-3 py-4 text-xs text-slate-500">Loading canonical blocks…</p> : null}
              {!isLoading && filtered.length === 0 ? <p className="px-3 py-4 text-xs text-slate-500">No canonical blocks found.</p> : null}

              <div ref={menuRef} className="divide-y divide-white/[0.06]">
                {filtered.map((block) => {
                  const active = selected?.id === block.id;
                  const itemUsage = blockUsage.get(block.key) ?? blockUsage.get(block.id) ?? block.usageCount ?? block.inUseCount;
                  const itemPreview = resolveTargetPreview(block).trim();
                  const hasPreview = itemPreview.length > 0;
                  const menuOpen = openMenuId === block.id;
                  return (
                    <div
                      key={block.id}
                      role="button"
                      tabIndex={0}
                      data-testid={`blocks-item-${block.id}`}
                      onClick={() => {
                        setSelectedId(block.id);
                        setOpenMenuId(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(block.id);
                          setOpenMenuId(null);
                        }
                      }}
                      className={`group relative w-full px-3 py-2 text-left transition-colors ${
                        active ? "border-l-4 border-l-blue-500 bg-blue-500/[0.14]" : "bg-transparent hover:bg-white/[0.03]"
                      }`}
                    >
                    <div className="flex gap-3">
                      <div className="h-16 w-24 shrink-0 overflow-hidden rounded border border-white/[0.1] bg-[#020d1f]" data-testid={`blocks-item-preview-${block.id}`}>
                          {hasPreview ? (
                            <iframe
                              title={`${block.key}-thumb`}
                              className="h-full w-full"
                              srcDoc={buildPreviewThumbnailDocument(itemPreview)}
                              sandbox="allow-scripts allow-same-origin"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center px-1 text-center text-[10px] text-slate-500">Preview unavailable</div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {renamingBlockId === block.id ? (
                                <input
                                  data-testid={`blocks-item-rename-input-${block.id}`}
                                  value={inlineBlockName}
                                  autoFocus
                                  onChange={(event) => setInlineBlockName(event.target.value)}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                  }}
                                  onBlur={() => {
                                    void commitInlineRename(block);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void commitInlineRename(block);
                                    }
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      cancelInlineRename();
                                    }
                                  }}
                                  className="w-full rounded border border-blue-400/35 bg-[#10233f] px-2 py-1 text-sm font-semibold text-slate-100"
                                />
                              ) : (
                                <p className={`truncate text-sm font-semibold ${active ? "text-blue-300" : "text-slate-100"}`}>{block.name}</p>
                              )}
                            </div>
                            <span className="relative flex shrink-0 items-center">
                              <button
                                type="button"
                                data-testid={`blocks-item-rename-${block.id}`}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  startInlineRename(block);
                                }}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-200"
                              >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                              <button
                                type="button"
                                data-testid={`blocks-item-menu-${block.id}`}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setSelectedId(block.id);
                                  setOpenMenuId((current) => (current === block.id ? null : block.id));
                                }}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-200"
                              >
                                <span className="material-symbols-outlined text-[18px]">more_vert</span>
                              </button>

                              {menuOpen ? (
                                <div className="absolute right-0 top-7 z-20 min-w-[180px] rounded-lg border border-white/[0.12] bg-[#0d1d36] p-1 shadow-2xl">
                                  <button
                                    type="button"
                                    data-testid={`blocks-menu-action-toggle-status-${block.id}`}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      void runBlockAction("toggle-status", block);
                                    }}
                                    className="block w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.08]"
                                  >
                                    {block.status === "active" ? "Set Inactive" : "Set Active"}
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`blocks-menu-action-duplicate-${block.id}`}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      void runBlockAction("duplicate", block);
                                    }}
                                    className="block w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.08]"
                                  >
                                    Duplicate Block
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`blocks-menu-action-delete-${block.id}`}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      void runBlockAction("delete", block);
                                    }}
                                    className="block w-full rounded px-2 py-1.5 text-left text-xs text-red-300 hover:bg-red-500/[0.16]"
                                  >
                                    Delete Block
                                  </button>
                                </div>
                              ) : null}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 uppercase tracking-wide text-slate-400">{block.family}</span>
                            <span className={`rounded border px-1.5 py-0.5 uppercase tracking-wide ${schemaBadgeTone(block.schemaStatus ?? "valid")}`}>
                              schema {block.schemaStatus ?? "valid"}
                            </span>
                            <span className={`rounded border px-1.5 py-0.5 uppercase tracking-wide ${lifecycleBadgeTone(block.lifecycle ?? "draft")}`}>
                              {block.lifecycle ?? "draft"}
                            </span>
                            <span className={`rounded border px-1.5 py-0.5 uppercase tracking-wide ${scopeBadgeTone(block.scope ?? "global")}`}>
                              {block.scope ?? "global"}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="material-symbols-outlined text-[12px]">link</span>
                            <span>{itemUsage} pages</span>
                            <span>•</span>
                            <span>{block.status}</span>
                          </div>
                          {block.importMasterKey ? (
                            <p className="mt-1 truncate text-[10px] font-mono text-slate-500" title={block.importMasterKey}>
                              {block.importMasterKey}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-col bg-[#081327]">
            {selected ? (
              <>
                <div className="border-b border-white/[0.08] bg-white/[0.015] px-5 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Visual Preview</h2>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewDevice("desktop")}
                        className={`rounded p-1.5 ${previewDevice === "desktop" ? "bg-blue-500/20 text-blue-200" : "bg-white/[0.03] text-slate-400"}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">desktop_windows</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice("tablet")}
                        className={`rounded p-1.5 ${previewDevice === "tablet" ? "bg-blue-500/20 text-blue-200" : "bg-white/[0.03] text-slate-400"}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">tablet_android</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice("mobile")}
                        className={`rounded p-1.5 ${previewDevice === "mobile" ? "bg-blue-500/20 text-blue-200" : "bg-white/[0.03] text-slate-400"}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">smartphone</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-auto rounded-xl border border-white/[0.12] bg-[#020d1f] p-3">
                    <div className={deviceFrameClass()} data-testid="blocks-selected-preview">
                      {resolveTargetPreview(selected).length > 0 ? (
                          <iframe
                            title={`${selected.key}-preview`}
                            className="h-full w-full rounded-lg border border-white/[0.08] bg-white"
                            srcDoc={resolveTargetPreview(selected)}
                            sandbox="allow-scripts allow-same-origin"
                          />
                      ) : (
                        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/[0.12] text-xs text-slate-500">
                          No preview available for this block.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">Properties</h3>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Block Name</label>
                      <input
                        data-testid="blocks-name-input"
                        value={selected.name}
                        onChange={(event) => patchSelected({ name: event.target.value })}
                        className="w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2 text-sm text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Visibility</label>
                      <div className="flex items-center justify-between rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2">
                        <span className="text-sm text-slate-200">{selected.status === "active" ? "Published" : selected.status}</span>
                        <button
                          type="button"
                          onClick={() => patchSelected({ status: selected.status === "active" ? "inactive" : "active" })}
                          className={`relative h-5 w-10 rounded-full ${selected.status === "active" ? "bg-blue-500" : "bg-slate-600"}`}
                        >
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${selected.status === "active" ? "right-0.5" : "left-0.5"}`}
                          />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lifecycle</label>
                      <select
                        value={selected.lifecycle ?? "draft"}
                        onChange={(event) => patchSelected({ lifecycle: event.target.value as StudioBlockTemplate["lifecycle"] })}
                        className="w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2 text-sm text-slate-200"
                      >
                        <option value="draft">draft</option>
                        <option value="published">published</option>
                        <option value="archived">archived</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</label>
                      <select
                        value={selected.status}
                        onChange={(event) => patchSelected({ status: event.target.value as StudioBlockTemplate["status"] })}
                        className="w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2 text-sm text-slate-200"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Block Type</label>
                      <div className="grid grid-cols-4 gap-2">
                        {["hero", "section", "conversion", "footer"].map((type) => {
                          const active = selected.family.toLowerCase().includes(type === "section" ? "section" : type);
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                if (type === "section") {
                                  patchSelected({ family: "feature_section" });
                                  return;
                                }
                                if (type === "conversion") {
                                  patchSelected({ family: "cta_banner" });
                                  return;
                                }
                                patchSelected({ family: type });
                              }}
                              className={`rounded-lg border p-2 text-center text-[10px] font-bold uppercase ${
                                active ? "border-blue-500 bg-blue-500/[0.12] text-blue-200" : "border-white/[0.1] bg-white/[0.02] text-slate-400"
                              }`}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Internal Description</label>
                      <textarea
                        value={selected.sourceRef ?? ""}
                        onChange={(event) => patchSelected({ sourceRef: event.target.value })}
                        rows={3}
                        className="w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2 text-sm text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-[11px] text-slate-300 md:grid-cols-2">
                    <p>
                      <span className="text-slate-500">Schema:</span> {selected.schemaStatus}
                    </p>
                    <p>
                      <span className="text-slate-500">Scope:</span> {selected.scope}
                    </p>
                    <p>
                      <span className="text-slate-500">Usage:</span> {selectedUsageCount} pages
                    </p>
                    <p className="truncate">
                      <span className="text-slate-500">Key:</span> {selected.key}
                    </p>
                    <p className="truncate">
                      <span className="text-slate-500">Import:</span> {selected.importMasterKey ?? "n/a"}
                    </p>
                  </div>

                  {whereUsedPages.length > 0 ? (
                    <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Used By</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {whereUsedPages.map((page) => (
                          <span key={page.id} className="rounded bg-white/[0.07] px-2 py-0.5 text-[10px] text-slate-300">
                            {page.slug}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-white/[0.08] pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        void loadBlocks(search);
                        setStatusMessage("Reverted unsaved block edits.");
                      }}
                      className="rounded-lg border border-white/[0.12] px-4 py-2 text-xs font-semibold text-slate-300"
                    >
                      Discard Changes
                    </button>
                    <button
                      data-testid="blocks-save-button"
                      type="button"
                      onClick={() => {
                        void saveSelected();
                      }}
                      disabled={isMutating}
                      className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {isMutating ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center px-5 py-12">
                <div className="rounded-xl border border-dashed border-white/[0.12] px-6 py-10 text-center text-sm text-slate-500">
                  Select a canonical block to inspect details.
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
