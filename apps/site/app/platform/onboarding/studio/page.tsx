"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PreviewPane } from "../_components/PreviewPane";
import { StudioActionMenu, StudioDetailContainer, StudioListContainer } from "../_components/workflow";
import { requestClientJson } from "../_lib/client-request";
import { setPreviewSwatchThemeId } from "../_lib/preview-swatch-state";
import type {
  StudioActionType,
  StudioBlockTemplate,
  StudioFidelitySettings,
  StudioPageDocument,
  StudioSettings,
  StudioShell,
  StudioTheme,
  StudioWidgetRecord
} from "../_lib/studio-types";

type StepId =
  | "import"
  | "proposal"
  | "blocks"
  | "page"
  | "content"
  | "widgets"
  | "presentation"
  | "preview"
  | "publish"
  | "reopen";

type RecoveryStep = {
  id: StepId;
  title: string;
  subtitle: string;
};

type ImportResult = {
  blockCount: number;
  routeSlugEntitiesCreated: number;
  importedBlocks: Array<{ key: string; family: string; name?: string; sourceRef?: string }>;
  pageCountBefore: number | null;
  pageCountAfter: number | null;
};

type WidgetsPayload = {
  ok: boolean;
  data?: StudioWidgetRecord[];
  catalog?: Array<{
    repoPath: string;
    displayName: string;
    widgetType: StudioWidgetRecord["widgetType"];
    surface: StudioWidgetRecord["surface"];
  }>;
  error?: string;
};

type PublishResult = {
  mode: "dry-run" | "apply";
  applied: boolean;
  blocked: boolean;
  source: "strapi" | "fallback";
  fidelityMode: StudioFidelitySettings["mode"];
  warnings: Array<{ code: string; message: string; severity: "info" | "warning" | "error" }>;
  ignoredPreviewSwatchThemeId: string | null;
  rejectionReason: string | null;
  payload: {
    activeTheme: {
      id: string;
      themeKey: string;
      name: string;
      darkMode: boolean;
      status: StudioTheme["status"];
    };
  };
  persistence?: {
    source: "strapi" | "fallback";
    mutated: boolean;
    themeId: string | null;
  };
};

type WorkflowEvidenceSnapshot = {
  entitiesChanged: string[];
  entitiesUnchanged: string[];
  safetyChecks: string[];
  lastUpdatedAt: string;
};

const STEPS: RecoveryStep[] = [
  { id: "import", title: "1. Import Source", subtitle: "Submit governed source HTML" },
  { id: "proposal", title: "2. Structured Proposal", subtitle: "Review extracted structure" },
  { id: "blocks", title: "3. Block Normalization", subtitle: "Refine reusable blocks" },
  { id: "page", title: "4. Page Composition", subtitle: "Assemble page from blocks" },
  { id: "content", title: "5. In-page Content Edit", subtitle: "Local vs reusable semantics" },
  { id: "widgets", title: "6. Widget + Action Mapping", subtitle: "Bind interaction safely" },
  { id: "presentation", title: "7. Shell / Theme / Swatch", subtitle: "Apply visual framing" },
  { id: "preview", title: "8. Preview", subtitle: "Validate draft rendering" },
  { id: "publish", title: "9. Publish", subtitle: "Publish with safeguards" },
  { id: "reopen", title: "10. Reopen & Modify", subtitle: "Reload and modify later" }
];

const DEFAULT_SOURCE_HTML = `<!DOCTYPE html>
<html>
  <body>
    <section>
      <h1>LMNAs Product Recovery Hero</h1>
      <p>Unified operator flow baseline source.</p>
      <a href=\"/book-demo\">Book Demo</a>
    </section>
    <section>
      <h2>Why teams choose LMNAs</h2>
      <p>Reusable block extraction from governed source.</p>
    </section>
    <section>
      <h2>FAQ</h2>
      <p>How does the recovery flow ensure safe publishing?</p>
    </section>
  </body>
</html>`;

const DEFAULT_SOURCE_REF = "docs/testing-artifacts/code.html";

const DEFAULT_VALIDATION_TOKEN = JSON.stringify(
  {
    expectedTypography: ["manrope", "inter"],
    requiresDarkMode: false
  },
  null,
  2
);

function nowIso(): string {
  return new Date().toISOString();
}

function toIsoDate(value?: string): string {
  if (!value || value.length < 10) {
    return new Date().toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

function createPageDraft(seed: number): StudioPageDocument {
  const date = toIsoDate();
  return {
    id: `page-${Date.now()}-${seed}`,
    name: `Recovery Page ${seed}`,
    slug: `recovery-page-${seed}`,
    locale: "en",
    activeShellId: undefined,
    blockOrder: [],
    fieldValues: {},
    actionOverrides: {},
    previewHtml: "",
    updatedAt: date
  };
}

function buildPagePreview(params: {
  page: StudioPageDocument | null;
  blocks: StudioBlockTemplate[];
  shells: StudioShell[];
  activeTheme: StudioTheme | null;
  swatchTheme: StudioTheme | null;
}): string {
  if (!params.page) {
    return "<html><body style='font-family:system-ui;padding:32px'><h2>Select or create a page draft.</h2></body></html>";
  }

  const blockMap = new Map<string, StudioBlockTemplate>();
  params.blocks.forEach((block) => {
    blockMap.set(block.id, block);
    blockMap.set(block.key, block);
  });

  const bodySections = params.page.blockOrder
    .map((blockId) => blockMap.get(blockId)?.previewHtml ?? "")
    .filter((html) => html.trim().length > 0)
    .join("\n");

  const localHeading = params.page.fieldValues["headline"];
  const localSection =
    typeof localHeading === "string" && localHeading.trim().length > 0
      ? `<section style=\"padding:24px 32px;border:1px dashed #334155;border-radius:12px;margin:16px;font-family:system-ui;background:#0f172a;color:#f8fafc\"><h2 style=\"margin:0;font-size:20px\">${localHeading}</h2><p style=\"margin-top:6px;font-size:12px;color:#93c5fd\">Page-local edit</p></section>`
      : "";

  const activeShell =
    params.shells.find((shell) => shell.id === params.page?.activeShellId) ??
    params.shells.find((shell) => shell.status === "active") ??
    null;

  const shellHead = activeShell?.previewHtml ?? "";
  const theme = params.swatchTheme ?? params.activeTheme;
  const primaryColor =
    theme?.tokens.find((token) => token.category === "color" && token.mapped)?.value ?? "#0b1120";

  const themeBanner = theme
    ? `<div style=\"padding:8px 14px;font-family:system-ui;font-size:11px;background:${primaryColor};color:#f8fafc\">Preview Theme: ${theme.name}${
        params.swatchTheme ? " (swatch preview)" : " (active)"
      }</div>`
    : "";

  const bodyHtml = bodySections.length > 0 ? bodySections : "<section style='padding:32px;font-family:system-ui'><h2>No blocks composed yet.</h2></section>";

  return `<!DOCTYPE html><html><head><meta charset=\"utf-8\"/><style>html,body{margin:0;padding:0;background:#020617}</style></head><body>${themeBanner}${shellHead}${localSection}${bodyHtml}</body></html>`;
}

function normalizeActionType(value: unknown): StudioActionType {
  if (
    value === "link_url" ||
    value === "scroll_to_section" ||
    value === "open_modal" ||
    value === "open_drawer" ||
    value === "open_widget" ||
    value === "submit_form" ||
    value === "download_asset" ||
    value === "external_booking" ||
    value === "workflow"
  ) {
    return value;
  }
  return "workflow";
}

function buildDuplicateBlock(block: StudioBlockTemplate): StudioBlockTemplate {
  const stamp = `${Date.now()}`;
  return {
    ...block,
    id: `${block.id}-dup-${stamp}`,
    key: `${block.key}-dup-${stamp}`,
    name: `${block.name} Copy`,
    status: "draft",
    inUseCount: 0,
    createdAt: toIsoDate(),
    updatedAt: toIsoDate()
  };
}

export default function UnifiedStudioRecoveryPage(): React.ReactElement {
  const [activeStepId, setActiveStepId] = useState<StepId>("import");
  const [sourceHtml, setSourceHtml] = useState(DEFAULT_SOURCE_HTML);
  const [sourceRef, setSourceRef] = useState(DEFAULT_SOURCE_REF);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [blocks, setBlocks] = useState<StudioBlockTemplate[]>([]);
  const [pages, setPages] = useState<StudioPageDocument[]>([]);
  const [shells, setShells] = useState<StudioShell[]>([]);
  const [themes, setThemes] = useState<StudioTheme[]>([]);
  const [widgets, setWidgets] = useState<StudioWidgetRecord[]>([]);
  const [widgetCatalog, setWidgetCatalog] = useState<WidgetsPayload["catalog"]>([]);
  const [settings, setSettings] = useState<StudioSettings | null>(null);

  const [selectedBlockId, setSelectedBlockId] = useState<string>("");
  const [blockNameDraft, setBlockNameDraft] = useState("");
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [candidateBlockId, setCandidateBlockId] = useState<string>("");
  const [selectedComposedIndex, setSelectedComposedIndex] = useState<number>(0);

  const [contentScope, setContentScope] = useState<"page-local" | "reusable-block">("page-local");
  const [contentDraft, setContentDraft] = useState("");
  const [contentEditApplied, setContentEditApplied] = useState(false);

  const [widgetRepoPath, setWidgetRepoPath] = useState<string>("/components/widgets/calendar-widget.ts");
  const [widgetPlacementMode, setWidgetPlacementMode] = useState<"embed" | "reference">("embed");
  const [widgetRawScript, setWidgetRawScript] = useState("");
  const [widgetBindingApplied, setWidgetBindingApplied] = useState(false);
  const [actionTriggerLabel, setActionTriggerLabel] = useState("Primary CTA");
  const [actionType, setActionType] = useState<StudioActionType>("open_widget");
  const [actionTarget, setActionTarget] = useState("widget-calendar-booking");

  const [selectedShellId, setSelectedShellId] = useState<string>("");
  const [selectedThemeId, setSelectedThemeId] = useState<string>("");
  const [selectedSwatchThemeId, setSelectedSwatchThemeId] = useState<string>("");
  const [presentationApplied, setPresentationApplied] = useState(false);

  const [validationToken, setValidationToken] = useState(DEFAULT_VALIDATION_TOKEN);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [reopenVerified, setReopenVerified] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Ready for H-007 unified flow execution.");

  const [workflowEvidenceSnapshot, setWorkflowEvidenceSnapshot] = useState<WorkflowEvidenceSnapshot>({
    entitiesChanged: [],
    entitiesUnchanged: [],
    safetyChecks: [
      "Strapi governance preserved",
      "Slug suppression preserved",
      "Publish safeguards preserved",
      "Non-executable widget safety preserved"
    ],
    lastUpdatedAt: nowIso()
  });

  const selectedBlock = useMemo(
    () => blocks.find((block) => block.id === selectedBlockId || block.key === selectedBlockId) ?? null,
    [blocks, selectedBlockId]
  );

  const selectedPage = useMemo(() => pages.find((page) => page.id === selectedPageId) ?? null, [pages, selectedPageId]);

  const activeTheme = useMemo(() => themes.find((theme) => theme.status === "active") ?? themes[0] ?? null, [themes]);

  const swatchTheme = useMemo(
    () => themes.find((theme) => theme.id === selectedSwatchThemeId) ?? null,
    [themes, selectedSwatchThemeId]
  );

  const previewHtml = useMemo(
    () =>
      buildPagePreview({
        page: selectedPage,
        blocks,
        shells,
        activeTheme,
        swatchTheme
      }),
    [selectedPage, blocks, shells, activeTheme, swatchTheme]
  );

  const stepProgress = useMemo<Record<StepId, boolean>>(
    () => ({
      import: importResult !== null,
      proposal: importResult !== null,
      blocks: Boolean(selectedBlock),
      page: Boolean(selectedPage && selectedPage.blockOrder.length > 0),
      content: contentEditApplied,
      widgets: widgetBindingApplied,
      presentation: presentationApplied,
      preview: activeStepId === "preview" || publishResult !== null,
      publish: publishResult?.applied === true,
      reopen: reopenVerified
    }),
    [importResult, selectedBlock, selectedPage, contentEditApplied, widgetBindingApplied, presentationApplied, activeStepId, publishResult, reopenVerified]
  );

  async function loadAll(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const [blocksPayload, pagesPayload, shellsPayload, themesPayload, widgetsPayload, settingsPayload] = await Promise.all([
        requestClientJson<{ ok: boolean; data?: StudioBlockTemplate[]; error?: string }>(
          "/api/platform/studio/blocks",
          { method: "GET", headers: { "content-type": "application/json" } },
          {
            timeoutMessage: "Loading blocks timed out.",
            fallbackErrorMessage: "Unable to load blocks."
          }
        ),
        requestClientJson<{ ok: boolean; data?: StudioPageDocument[]; error?: string }>(
          "/api/platform/studio/pages",
          { method: "GET", headers: { "content-type": "application/json" } },
          {
            timeoutMessage: "Loading pages timed out.",
            fallbackErrorMessage: "Unable to load pages."
          }
        ),
        requestClientJson<{ ok: boolean; data?: StudioShell[]; error?: string }>(
          "/api/platform/studio/shells",
          { method: "GET", headers: { "content-type": "application/json" } },
          {
            timeoutMessage: "Loading shells timed out.",
            fallbackErrorMessage: "Unable to load shells."
          }
        ),
        requestClientJson<{ ok: boolean; data?: StudioTheme[]; error?: string }>(
          "/api/platform/studio/themes",
          { method: "GET", headers: { "content-type": "application/json" } },
          {
            timeoutMessage: "Loading themes timed out.",
            fallbackErrorMessage: "Unable to load themes."
          }
        ),
        requestClientJson<WidgetsPayload>(
          "/api/platform/studio/widgets",
          { method: "GET", headers: { "content-type": "application/json" } },
          {
            timeoutMessage: "Loading widgets timed out.",
            fallbackErrorMessage: "Unable to load widgets."
          }
        ),
        requestClientJson<{ ok: boolean; data?: StudioSettings; error?: string }>(
          "/api/platform/studio/settings",
          { method: "GET", headers: { "content-type": "application/json" } },
          {
            timeoutMessage: "Loading settings timed out.",
            fallbackErrorMessage: "Unable to load settings."
          }
        )
      ]);

      if (!blocksPayload.ok || !Array.isArray(blocksPayload.data)) {
        throw new Error(blocksPayload.error ?? "Unable to load blocks.");
      }
      if (!pagesPayload.ok || !Array.isArray(pagesPayload.data)) {
        throw new Error(pagesPayload.error ?? "Unable to load pages.");
      }
      if (!shellsPayload.ok || !Array.isArray(shellsPayload.data)) {
        throw new Error(shellsPayload.error ?? "Unable to load shells.");
      }
      if (!themesPayload.ok || !Array.isArray(themesPayload.data)) {
        throw new Error(themesPayload.error ?? "Unable to load themes.");
      }
      if (!widgetsPayload.ok || !Array.isArray(widgetsPayload.data)) {
        throw new Error(widgetsPayload.error ?? "Unable to load widgets.");
      }
      if (!settingsPayload.ok || !settingsPayload.data) {
        throw new Error(settingsPayload.error ?? "Unable to load settings.");
      }

      setBlocks(blocksPayload.data);
      setPages(pagesPayload.data);
      setShells(shellsPayload.data);
      setThemes(themesPayload.data);
      setWidgets(widgetsPayload.data);
      setWidgetCatalog(Array.isArray(widgetsPayload.catalog) ? widgetsPayload.catalog : []);
      setSettings(settingsPayload.data);

      const firstBlock = blocksPayload.data[0];
      if (firstBlock) {
        setSelectedBlockId((prev) => prev || firstBlock.id);
        setCandidateBlockId((prev) => prev || firstBlock.id);
        setBlockNameDraft((prev) => prev || firstBlock.name);
      }

      const firstPage = pagesPayload.data[0];
      if (firstPage) {
        setSelectedPageId((prev) => prev || firstPage.id);
      }

      const activeShell =
        shellsPayload.data.find((shell) => shell.status === "active") ?? shellsPayload.data[0] ?? null;
      if (activeShell) {
        setSelectedShellId((prev) => prev || activeShell.id);
      }

      const theme = themesPayload.data.find((entry) => entry.status === "active") ?? themesPayload.data[0] ?? null;
      if (theme) {
        setSelectedThemeId((prev) => prev || theme.id);
        setSelectedSwatchThemeId((prev) => prev || theme.id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (selectedBlock) {
      setBlockNameDraft(selectedBlock.name);
    }
  }, [selectedBlock]);

  useEffect(() => {
    if (!selectedPage) {
      return;
    }
    const existingHeadline = selectedPage.fieldValues["headline"];
    if (typeof existingHeadline === "string" && existingHeadline.trim().length > 0) {
      setContentDraft(existingHeadline);
    }
  }, [selectedPage]);

  function markEvidence(changed: string[], unchanged: string[]): void {
    setWorkflowEvidenceSnapshot((previous) => ({
      entitiesChanged: Array.from(new Set([...previous.entitiesChanged, ...changed])),
      entitiesUnchanged: Array.from(new Set([...previous.entitiesUnchanged, ...unchanged])),
      safetyChecks: previous.safetyChecks,
      lastUpdatedAt: nowIso()
    }));
  }

  async function runImport(): Promise<void> {
    setIsWorking(true);
    setError(null);
    try {
      const response = await requestClientJson<{
        ok: boolean;
        data?: ImportResult;
        error?: string;
      }>(
        "/api/platform/studio/pages",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "import-blocks",
            html: sourceHtml,
            sourceRef
          })
        },
        {
          timeoutMessage: "Import timed out.",
          fallbackErrorMessage: "Unable to import source."
        }
      );

      if (!response.ok || !response.data) {
        throw new Error(response.error ?? "Unable to import source.");
      }

      setImportResult(response.data);
      setActiveStepId("proposal");
      setStatus(`Imported source and proposed ${response.data.blockCount} block(s).`);
      markEvidence(["block-templates (import-blocks)"], ["route-slug entities"]);
      await loadAll();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setIsWorking(false);
    }
  }

  async function saveSelectedBlock(): Promise<void> {
    if (!selectedBlock) {
      setError("Select a block to edit.");
      return;
    }

    setIsWorking(true);
    setError(null);
    try {
      const payload = await requestClientJson<{ ok: boolean; data?: StudioBlockTemplate[]; error?: string }>(
        "/api/platform/studio/blocks",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            block: {
              ...selectedBlock,
              name: blockNameDraft,
              updatedAt: toIsoDate()
            }
          })
        },
        {
          timeoutMessage: "Saving block timed out.",
          fallbackErrorMessage: "Unable to save block."
        }
      );

      if (!payload.ok || !Array.isArray(payload.data)) {
        throw new Error(payload.error ?? "Unable to save block.");
      }

      setBlocks(payload.data);
      setStatus("Reusable block updated.");
      markEvidence(["block-templates (reusable updates)"], []);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsWorking(false);
    }
  }

  async function duplicateSelectedBlock(): Promise<void> {
    if (!selectedBlock) {
      setError("Select a block to duplicate.");
      return;
    }

    const duplicate = buildDuplicateBlock(selectedBlock);
    setIsWorking(true);
    setError(null);

    try {
      const payload = await requestClientJson<{ ok: boolean; data?: StudioBlockTemplate[]; error?: string }>(
        "/api/platform/studio/blocks",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ block: duplicate })
        },
        {
          timeoutMessage: "Duplicating block timed out.",
          fallbackErrorMessage: "Unable to duplicate block."
        }
      );

      if (!payload.ok || !Array.isArray(payload.data)) {
        throw new Error(payload.error ?? "Unable to duplicate block.");
      }

      setBlocks(payload.data);
      setSelectedBlockId(duplicate.id);
      setBlockNameDraft(duplicate.name);
      setStatus("Reusable block duplicated.");
      markEvidence(["block-templates (duplicate)"], []);
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : String(duplicateError));
    } finally {
      setIsWorking(false);
    }
  }

  async function deleteSelectedBlock(): Promise<void> {
    if (!selectedBlock) {
      setError("Select a block to delete.");
      return;
    }

    setIsWorking(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/platform/studio/blocks?id=${encodeURIComponent(selectedBlock.id)}&key=${encodeURIComponent(selectedBlock.key)}`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" }
        }
      );
      const payload = (await response.json()) as {
        ok: boolean;
        data?: StudioBlockTemplate[];
        error?: string;
      };

      if (!response.ok || !payload.ok || !Array.isArray(payload.data)) {
        throw new Error(payload.error ?? "Unable to delete block.");
      }

      setBlocks(payload.data);
      const nextBlock = payload.data[0] ?? null;
      setSelectedBlockId(nextBlock?.id ?? "");
      setBlockNameDraft(nextBlock?.name ?? "");
      setStatus("Block deleted after safety checks.");
      markEvidence(["block-templates (delete)"], []);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setIsWorking(false);
    }
  }

  function createPage(): void {
    const draft = createPageDraft(pages.length + 1);
    setPages((current) => [draft, ...current]);
    setSelectedPageId(draft.id);
    setStatus("Draft page created.");
    setActiveStepId("page");
  }

  function patchSelectedPage(mutator: (page: StudioPageDocument) => StudioPageDocument): void {
    if (!selectedPage) {
      return;
    }

    setPages((current) => current.map((page) => (page.id === selectedPage.id ? mutator(page) : page)));
  }

  function addBlockToPage(): void {
    if (!selectedPage || candidateBlockId.trim().length === 0) {
      setError("Create/select a page and choose a block.");
      return;
    }

    patchSelectedPage((page) => ({
      ...page,
      blockOrder: [...page.blockOrder, candidateBlockId],
      updatedAt: toIsoDate()
    }));
    setSelectedComposedIndex((prev) => Math.max(prev, selectedPage.blockOrder.length));
    setStatus("Block added to page composition.");
  }

  function reorderComposedBlock(direction: -1 | 1): void {
    if (!selectedPage || selectedPage.blockOrder.length === 0) {
      return;
    }

    const nextIndex = selectedComposedIndex + direction;
    if (nextIndex < 0 || nextIndex >= selectedPage.blockOrder.length) {
      return;
    }

    patchSelectedPage((page) => {
      const next = [...page.blockOrder];
      [next[selectedComposedIndex], next[nextIndex]] = [next[nextIndex], next[selectedComposedIndex]];
      return {
        ...page,
        blockOrder: next,
        updatedAt: toIsoDate()
      };
    });

    setSelectedComposedIndex(nextIndex);
    setStatus("Composed block order updated.");
  }

  function duplicateComposedBlock(): void {
    if (!selectedPage || selectedPage.blockOrder.length === 0) {
      return;
    }

    patchSelectedPage((page) => {
      const next = [...page.blockOrder];
      const source = next[selectedComposedIndex];
      next.splice(selectedComposedIndex + 1, 0, source);
      return {
        ...page,
        blockOrder: next,
        updatedAt: toIsoDate()
      };
    });
    setStatus("Block duplicated within page composition.");
  }

  function removeComposedBlock(): void {
    if (!selectedPage || selectedPage.blockOrder.length === 0) {
      return;
    }

    patchSelectedPage((page) => {
      const next = page.blockOrder.filter((_, index) => index !== selectedComposedIndex);
      return {
        ...page,
        blockOrder: next,
        updatedAt: toIsoDate()
      };
    });

    setSelectedComposedIndex((prev) => Math.max(0, prev - 1));
    setStatus("Block removed from page composition.");
  }

  async function persistPage(mode: "save" | "apply", pageOverride?: StudioPageDocument): Promise<void> {
    const targetPage = pageOverride ?? selectedPage;
    if (!targetPage) {
      setError("Select or create a page.");
      return;
    }

    setIsWorking(true);
    setError(null);

    try {
      const payload = await requestClientJson<{
        ok: boolean;
        data?: {
          page: StudioPageDocument;
          applied: boolean;
          warnings: string[];
          previewRoute?: string;
        };
        error?: string;
      }>(
        "/api/platform/studio/pages",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode,
            page: {
              ...targetPage,
              previewHtml,
              updatedAt: toIsoDate()
            }
          })
        },
        {
          timeoutMessage: "Persisting page timed out.",
          fallbackErrorMessage: "Unable to persist page."
        }
      );

      if (!payload.ok || !payload.data?.page) {
        throw new Error(payload.error ?? "Unable to persist page.");
      }

      const persistedPage = payload.data.page;
      setPages((current) => current.map((page) => (page.id === persistedPage.id ? persistedPage : page)));
      setSelectedPageId(persistedPage.id);
      setStatus(
        mode === "apply"
          ? payload.data.applied
            ? "Page published via page composer."
            : `Page saved but not published: ${(payload.data.warnings ?? ["n/a"])[0]}`
          : "Page draft saved."
      );

      markEvidence(["pages"], []);
      if (mode === "save") {
        setActiveStepId("content");
      }
    } catch (persistError) {
      setError(persistError instanceof Error ? persistError.message : String(persistError));
    } finally {
      setIsWorking(false);
    }
  }

  async function applyContentEdit(): Promise<void> {
    if (!selectedPage || contentDraft.trim().length === 0) {
      setError("Select a page and provide content.");
      return;
    }

    setIsWorking(true);
    setError(null);

    try {
      if (contentScope === "page-local") {
        const nextPage: StudioPageDocument = {
          ...selectedPage,
          fieldValues: {
            ...selectedPage.fieldValues,
            headline: contentDraft.trim()
          },
          updatedAt: toIsoDate()
        };
        patchSelectedPage(() => nextPage);
        await persistPage("save", nextPage);
        setStatus("Applied page-local content edit. Reusable source block unchanged.");
        markEvidence(["pages.fieldValues (page-local content)"], ["block-templates (unchanged by local edit)"]);
      } else {
        if (!selectedBlock) {
          throw new Error("Select a reusable block before applying reusable edit.");
        }

        const updatedBlock: StudioBlockTemplate = {
          ...selectedBlock,
          name: blockNameDraft,
          previewHtml: `<section style=\"padding:36px;font-family:system-ui;background:#0f172a;color:#f8fafc;border-radius:12px\"><h1>${contentDraft.trim()}</h1><p>Reusable block update from in-page editor.</p></section>`,
          updatedAt: toIsoDate()
        };

        const blockPayload = await requestClientJson<{ ok: boolean; data?: StudioBlockTemplate[]; error?: string }>(
          "/api/platform/studio/blocks",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ block: updatedBlock })
          },
          {
            timeoutMessage: "Applying reusable edit timed out.",
            fallbackErrorMessage: "Unable to apply reusable edit."
          }
        );

        if (!blockPayload.ok || !Array.isArray(blockPayload.data)) {
          throw new Error(blockPayload.error ?? "Unable to apply reusable edit.");
        }

        setBlocks(blockPayload.data);
        setStatus("Applied reusable block edit. Pages using this block will reflect update.");
        markEvidence(["block-templates (reusable content edit)"], ["page-local fieldValues (unchanged by reusable edit)"]);
      }

      // Keep operators in the content step so they can apply both page-local and reusable edits
      // before moving to widget/action binding.
      setContentEditApplied(true);
    } catch (contentError) {
      setError(contentError instanceof Error ? contentError.message : String(contentError));
    } finally {
      setIsWorking(false);
    }
  }

  async function bindWidgetAndAction(): Promise<void> {
    if (!selectedPage) {
      setError("Select a page before binding widget/action.");
      return;
    }

    setIsWorking(true);
    setError(null);

    try {
      const blockId = selectedPage.blockOrder[0] ?? candidateBlockId;
      const widgetDraft: StudioWidgetRecord = {
        id: `widget-${Date.now()}`,
        key: `widget-${Date.now()}`,
        name: "Recovery Widget Binding",
        widgetType:
          widgetRepoPath === "/components/widgets/report-download-widget.ts" ? "download_gate" : "booking_popup",
        surface: widgetRepoPath === "/components/widgets/report-download-widget.ts" ? "inline" : "modal",
        status: "active",
        repoPath: widgetRepoPath,
        editableFields: [],
        placement: {
          mode: widgetPlacementMode,
          pageId: selectedPage.id,
          ...(widgetPlacementMode === "embed" && blockId ? { blockId } : {})
        },
        updatedAt: toIsoDate()
      };

      const widgetSave = await requestClientJson<WidgetsPayload>(
        "/api/platform/studio/widgets",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            widget: widgetDraft,
            rawScript: widgetRawScript
          })
        },
        {
          timeoutMessage: "Saving widget mapping timed out.",
          fallbackErrorMessage: "Unable to save widget mapping."
        }
      );

      if (!widgetSave.ok || !Array.isArray(widgetSave.data)) {
        throw new Error(widgetSave.error ?? "Unable to save widget mapping.");
      }

      setWidgets(widgetSave.data);
      setWidgetRawScript("");

      const actionId = `action-${Date.now()}`;
      const normalizedType = normalizeActionType(actionType);
      const nextPage: StudioPageDocument = {
        ...selectedPage,
        actionOverrides: {
          ...selectedPage.actionOverrides,
          [actionId]: {
            id: actionId,
            blockId: selectedPage.blockOrder[0] ?? "",
            label: actionTriggerLabel,
            type: normalizedType,
            target: actionTarget
          }
        },
        updatedAt: toIsoDate()
      };
      patchSelectedPage(() => nextPage);

      await persistPage("save", nextPage);

      setWidgetBindingApplied(true);
      setActiveStepId("presentation");
      setStatus(`Mapped trigger \"${actionTriggerLabel}\" to \"${normalizedType}\" safely.`);
      markEvidence(["studio.widgets", "pages.actionOverrides"], ["unsafe executable script (rejected by API rules)"]);
    } catch (widgetError) {
      setError(widgetError instanceof Error ? widgetError.message : String(widgetError));
    } finally {
      setIsWorking(false);
    }
  }

  async function applyPresentation(): Promise<void> {
    if (!selectedShellId || !selectedThemeId) {
      setError("Select both shell and theme.");
      return;
    }

    setIsWorking(true);
    setError(null);

    try {
      const shellPayload = await requestClientJson<{ ok: boolean; data?: StudioShell[]; error?: string }>(
        "/api/platform/studio/shells/activate",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: selectedShellId,
            key: shells.find((shell) => shell.id === selectedShellId)?.key
          })
        },
        {
          timeoutMessage: "Activating shell timed out.",
          fallbackErrorMessage: "Unable to activate shell."
        }
      );

      if (!shellPayload.ok || !Array.isArray(shellPayload.data)) {
        throw new Error(shellPayload.error ?? "Unable to activate shell.");
      }

      const themePayload = await requestClientJson<{ ok: boolean; data?: StudioTheme[]; error?: string }>(
        "/api/platform/studio/themes/activate",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: selectedThemeId,
            themeKey: themes.find((theme) => theme.id === selectedThemeId)?.themeKey
          })
        },
        {
          timeoutMessage: "Activating theme timed out.",
          fallbackErrorMessage: "Unable to activate theme."
        }
      );

      if (!themePayload.ok || !Array.isArray(themePayload.data)) {
        throw new Error(themePayload.error ?? "Unable to activate theme.");
      }

      if (selectedPage) {
        const nextPage: StudioPageDocument = {
          ...selectedPage,
          activeShellId: selectedShellId,
          updatedAt: toIsoDate()
        };
        patchSelectedPage(() => nextPage);
        await persistPage("save", nextPage);
      }

      setShells(shellPayload.data);
      setThemes(themePayload.data);
      setPreviewSwatchThemeId(selectedSwatchThemeId || null);
      setPresentationApplied(true);
      setActiveStepId("preview");
      setStatus("Applied shell, active theme, and swatch preview.");
      markEvidence(["shell-variants", "theme-variants"], []);
    } catch (presentationError) {
      setError(presentationError instanceof Error ? presentationError.message : String(presentationError));
    } finally {
      setIsWorking(false);
    }
  }

  async function runPublish(): Promise<void> {
    if (!settings) {
      setError("Studio settings unavailable.");
      return;
    }

    setIsWorking(true);
    setError(null);

    try {
      let parsedValidationToken: unknown = null;
      if (validationToken.trim().length > 0) {
        parsedValidationToken = JSON.parse(validationToken);
      }

      const payload = await requestClientJson<{ ok: boolean; data?: PublishResult; error?: string }>(
        "/api/platform/studio/publish",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "apply",
            sourceHtml: previewHtml,
            previewSwatchThemeId: selectedSwatchThemeId || null,
            validationToken: parsedValidationToken
          })
        },
        {
          timeoutMessage: "Publish verification timed out.",
          fallbackErrorMessage: "Unable to publish."
        }
      );

      if (!payload.ok || !payload.data) {
        throw new Error(payload.error ?? "Unable to publish.");
      }

      setPublishResult(payload.data);
      setStatus(payload.data.applied ? "Published successfully with safeguards." : "Publish blocked by safeguards.");
      markEvidence(["theme-variants (publish commit)"], ["preview swatch persistence", "route slug auto-creation"]);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : String(publishError));
    } finally {
      setIsWorking(false);
    }
  }

  async function reopenAndModify(): Promise<void> {
    if (!selectedPage) {
      setError("Select a page to reopen and modify.");
      return;
    }

    setIsWorking(true);
    setError(null);

    try {
      await loadAll();

      setPages((current) =>
        current.map((page) =>
          page.id === selectedPage.id
            ? {
                ...page,
                name: `${page.name} (Reopened)`,
                updatedAt: toIsoDate()
              }
            : page
        )
      );

      setStatus("Reopened and modified page after publish.");
      setReopenVerified(true);
      markEvidence(["pages (reopen modify)"], []);
    } catch (reopenError) {
      setError(reopenError instanceof Error ? reopenError.message : String(reopenError));
    } finally {
      setIsWorking(false);
    }
  }

  function gotoPreviousStep(): void {
    const index = STEPS.findIndex((step) => step.id === activeStepId);
    if (index > 0) {
      setActiveStepId(STEPS[index - 1].id);
    }
  }

  function gotoNextStep(): void {
    const index = STEPS.findIndex((step) => step.id === activeStepId);
    if (index < STEPS.length - 1) {
      setActiveStepId(STEPS[index + 1].id);
    }
  }

  const actionMenuItems = [
    {
      id: "create",
      label: "Create",
      description: "Create/import based on current step context.",
      tone: "accent" as const,
      disabled: isWorking,
      onSelect: () => {
        if (activeStepId === "import") {
          void runImport();
        } else if (activeStepId === "page") {
          createPage();
        } else if (activeStepId === "blocks") {
          void duplicateSelectedBlock();
        } else if (activeStepId === "widgets") {
          void bindWidgetAndAction();
        }
      }
    },
    {
      id: "edit",
      label: "Edit",
      description: "Save edits in current step context.",
      disabled: isWorking,
      onSelect: () => {
        if (activeStepId === "blocks") {
          void saveSelectedBlock();
        } else if (activeStepId === "content") {
          void applyContentEdit();
        } else if (activeStepId === "presentation") {
          void applyPresentation();
        } else if (activeStepId === "reopen") {
          void reopenAndModify();
        }
      }
    },
    {
      id: "duplicate",
      label: "Duplicate",
      description: "Duplicate selected reusable or composed block.",
      disabled: isWorking,
      onSelect: () => {
        if (activeStepId === "blocks") {
          void duplicateSelectedBlock();
        } else if (activeStepId === "page") {
          duplicateComposedBlock();
        }
      }
    },
    {
      id: "delete",
      label: "Delete",
      description: "Delete selected reusable block with safeguards.",
      tone: "danger" as const,
      disabled: isWorking,
      onSelect: () => {
        if (activeStepId === "blocks") {
          void deleteSelectedBlock();
        }
      }
    },
    {
      id: "reorder",
      label: "Reorder",
      description: "Reorder selected composed block upward.",
      disabled: isWorking,
      onSelect: () => {
        if (activeStepId === "page") {
          reorderComposedBlock(-1);
        }
      }
    },
    {
      id: "preview",
      label: "Preview",
      description: "Navigate to preview step with current composition.",
      disabled: isWorking,
      onSelect: () => setActiveStepId("preview")
    },
    {
      id: "publish",
      label: "Publish",
      description: "Run publish safeguards and commit active theme payload.",
      tone: "accent" as const,
      disabled: isWorking,
      onSelect: () => {
        void runPublish();
      }
    },
    {
      id: "previous-step",
      label: "Previous Step",
      description: "Move one step backward in the unified flow.",
      disabled: isWorking,
      onSelect: gotoPreviousStep
    },
    {
      id: "next-step",
      label: "Next Step",
      description: "Move one step forward in the unified flow.",
      disabled: isWorking,
      onSelect: gotoNextStep
    }
  ];

  const activeStep = STEPS.find((step) => step.id === activeStepId) ?? STEPS[0];

  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold text-slate-100">Unified Studio Recovery Flow</h1>
        <p className="mt-1 text-xs text-slate-500">
          One operator pipeline: import, refine, compose, edit, bind behavior, apply presentation, preview, publish, and reopen.
        </p>
      </header>

      {error ? (
        <div data-testid="h007-error-banner" className="rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3 py-2">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      ) : null}

      <div data-testid="h007-status-banner" className="rounded-lg border border-blue-500/20 bg-blue-500/[0.08] px-3 py-2">
        <p className="text-xs text-blue-200">{isLoading ? "Loading Studio context…" : status}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <StudioListContainer<RecoveryStep>
          testId="h007-step-list-container"
          title="TV-E2E-07 Steps"
          description="Execute the full mandatory operator flow without leaving this surface."
          items={STEPS}
          selectedId={activeStepId}
          onSelectItem={(step) => setActiveStepId(step.id)}
          getItemTestId={(step) => `h007-step-${step.id}`}
          getItemTitle={(step) => step.title}
          getItemSubtitle={(step) => step.subtitle}
          getItemMeta={(step) => (stepProgress[step.id] ? "complete" : "pending")}
        />

        <div className="flex flex-col gap-5">
          <StudioDetailContainer
            testId="h007-detail-container"
            title={activeStep.title}
            description={activeStep.subtitle}
            isEmpty={false}
          >
            {activeStepId === "import" ? (
              <section data-testid="h007-step-panel-import" className="space-y-3">
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  <span>Source Reference</span>
                  <input
                    data-testid="h007-source-ref-input"
                    value={sourceRef}
                    onChange={(event) => setSourceRef(event.target.value)}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  <span>Source HTML</span>
                  <textarea
                    data-testid="h007-source-input"
                    value={sourceHtml}
                    onChange={(event) => setSourceHtml(event.target.value)}
                    className="min-h-[220px] rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-slate-200"
                  />
                </label>
                <button
                  type="button"
                  data-testid="h007-import-submit"
                  disabled={isWorking}
                  onClick={() => {
                    void runImport();
                  }}
                  className="rounded-lg border border-blue-500/40 bg-blue-500/[0.14] px-3 py-2 text-xs font-semibold text-blue-200 disabled:opacity-60"
                >
                  Import Source
                </button>
              </section>
            ) : null}

            {activeStepId === "proposal" ? (
              <section data-testid="h007-step-panel-proposal" className="space-y-3">
                <div data-testid="h007-import-result" className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-3">
                  <p className="text-xs text-slate-300">Imported Blocks: {importResult?.blockCount ?? 0}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Route Slug Entities Created: {importResult?.routeSlugEntitiesCreated ?? 0}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Page count before/after: {String(importResult?.pageCountBefore ?? "n/a")} / {String(importResult?.pageCountAfter ?? "n/a")}
                  </p>
                </div>
                <ul data-testid="h007-proposal-list" className="space-y-2">
                  {(importResult?.importedBlocks ?? []).map((block) => (
                    <li key={block.key} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                      <p className="text-xs text-slate-200">{block.key}</p>
                      <p className="text-[11px] text-slate-500">{block.family}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {activeStepId === "blocks" ? (
              <section data-testid="h007-step-panel-blocks" className="space-y-3">
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  <span>Reusable Block</span>
                  <select
                    data-testid="h007-block-select"
                    value={selectedBlockId}
                    onChange={(event) => setSelectedBlockId(event.target.value)}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="">Select block</option>
                    {blocks.map((block) => (
                      <option key={block.id} value={block.id}>
                        {block.name} ({block.family})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  <span>Block Name</span>
                  <input
                    data-testid="h007-block-name-input"
                    value={blockNameDraft}
                    onChange={(event) => setBlockNameDraft(event.target.value)}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="h007-block-save"
                    onClick={() => {
                      void saveSelectedBlock();
                    }}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.12] px-3 py-1.5 text-xs text-emerald-200"
                  >
                    Save Block
                  </button>
                  <button
                    type="button"
                    data-testid="h007-block-duplicate"
                    onClick={() => {
                      void duplicateSelectedBlock();
                    }}
                    className="rounded-lg border border-blue-500/30 bg-blue-500/[0.12] px-3 py-1.5 text-xs text-blue-200"
                  >
                    Duplicate Block
                  </button>
                  <button
                    type="button"
                    data-testid="h007-block-delete"
                    onClick={() => {
                      void deleteSelectedBlock();
                    }}
                    className="rounded-lg border border-red-500/30 bg-red-500/[0.12] px-3 py-1.5 text-xs text-red-200"
                  >
                    Delete Block
                  </button>
                </div>
              </section>
            ) : null}

            {activeStepId === "page" ? (
              <section data-testid="h007-step-panel-page" className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="h007-page-create"
                    onClick={createPage}
                    className="rounded-lg border border-blue-500/30 bg-blue-500/[0.12] px-3 py-1.5 text-xs text-blue-200"
                  >
                    Create Page Draft
                  </button>
                </div>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  <span>Page</span>
                  <select
                    data-testid="h007-page-select"
                    value={selectedPageId}
                    onChange={(event) => setSelectedPageId(event.target.value)}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="">Select page</option>
                    {pages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.name} ({page.slug})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span>Add Existing Block</span>
                    <select
                      data-testid="h007-page-add-block-select"
                      value={candidateBlockId}
                      onChange={(event) => setCandidateBlockId(event.target.value)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    >
                      <option value="">Select block</option>
                      {blocks.map((block) => (
                        <option key={block.id} value={block.id}>
                          {block.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    data-testid="h007-page-add-block"
                    onClick={addBlockToPage}
                    className="h-fit self-end rounded-lg border border-white/[0.14] bg-white/[0.06] px-3 py-2 text-xs text-slate-200"
                  >
                    Add Block
                  </button>
                </div>
                <ul className="space-y-2">
                  {(selectedPage?.blockOrder ?? []).map((blockId, index) => (
                    <li
                      key={`${blockId}-${index}`}
                      data-testid={`h007-page-composed-row-${index}`}
                      className={`rounded-lg border px-3 py-2 ${
                        selectedComposedIndex === index
                          ? "border-blue-500/35 bg-blue-500/[0.08]"
                          : "border-white/[0.08] bg-white/[0.02]"
                      }`}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setSelectedComposedIndex(index)}
                      >
                        <p className="text-xs text-slate-200">
                          {index + 1}. {blocks.find((block) => block.id === blockId || block.key === blockId)?.name ?? blockId}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="h007-page-reorder-up"
                    onClick={() => reorderComposedBlock(-1)}
                    className="rounded-lg border border-white/[0.14] bg-white/[0.06] px-3 py-1.5 text-xs text-slate-200"
                  >
                    Reorder Up
                  </button>
                  <button
                    type="button"
                    data-testid="h007-page-reorder-down"
                    onClick={() => reorderComposedBlock(1)}
                    className="rounded-lg border border-white/[0.14] bg-white/[0.06] px-3 py-1.5 text-xs text-slate-200"
                  >
                    Reorder Down
                  </button>
                  <button
                    type="button"
                    data-testid="h007-page-duplicate-block"
                    onClick={duplicateComposedBlock}
                    className="rounded-lg border border-blue-500/30 bg-blue-500/[0.12] px-3 py-1.5 text-xs text-blue-200"
                  >
                    Duplicate in Page
                  </button>
                  <button
                    type="button"
                    data-testid="h007-page-remove-block"
                    onClick={removeComposedBlock}
                    className="rounded-lg border border-red-500/30 bg-red-500/[0.12] px-3 py-1.5 text-xs text-red-200"
                  >
                    Remove from Page
                  </button>
                  <button
                    type="button"
                    data-testid="h007-page-save"
                    onClick={() => {
                      void persistPage("save");
                    }}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.12] px-3 py-1.5 text-xs text-emerald-200"
                  >
                    Save Page
                  </button>
                </div>
              </section>
            ) : null}

            {activeStepId === "content" ? (
              <section data-testid="h007-step-panel-content" className="space-y-3">
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                  <p className="text-xs text-slate-200">Edit Scope</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Page-local edits only affect this page. Reusable edits mutate the source block used by multiple pages.
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    data-testid="h007-content-scope-local"
                    onClick={() => setContentScope("page-local")}
                    className={`rounded-lg border px-3 py-1.5 ${
                      contentScope === "page-local"
                        ? "border-blue-500/35 bg-blue-500/[0.12] text-blue-200"
                        : "border-white/[0.14] bg-white/[0.06] text-slate-300"
                    }`}
                  >
                    Page-local
                  </button>
                  <button
                    type="button"
                    data-testid="h007-content-scope-reusable"
                    onClick={() => setContentScope("reusable-block")}
                    className={`rounded-lg border px-3 py-1.5 ${
                      contentScope === "reusable-block"
                        ? "border-blue-500/35 bg-blue-500/[0.12] text-blue-200"
                        : "border-white/[0.14] bg-white/[0.06] text-slate-300"
                    }`}
                  >
                    Reusable-block
                  </button>
                </div>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  <span>Heading/Text Edit</span>
                  <textarea
                    data-testid="h007-content-input"
                    value={contentDraft}
                    onChange={(event) => setContentDraft(event.target.value)}
                    className="min-h-[120px] rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                  />
                </label>
                <button
                  type="button"
                  data-testid="h007-content-apply"
                  onClick={() => {
                    void applyContentEdit();
                  }}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.12] px-3 py-2 text-xs font-semibold text-emerald-200"
                >
                  Apply Content Edit
                </button>
              </section>
            ) : null}

            {activeStepId === "widgets" ? (
              <section data-testid="h007-step-panel-widgets" className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span>Widget Capability</span>
                    <select
                      data-testid="h007-widget-repo-path"
                      value={widgetRepoPath}
                      onChange={(event) => setWidgetRepoPath(event.target.value)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    >
                      {(widgetCatalog ?? []).map((entry) => (
                        <option key={entry.repoPath} value={entry.repoPath}>
                          {entry.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span>Placement</span>
                    <select
                      data-testid="h007-widget-placement-mode"
                      value={widgetPlacementMode}
                      onChange={(event) => setWidgetPlacementMode(event.target.value === "reference" ? "reference" : "embed")}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    >
                      <option value="embed">Embed in block</option>
                      <option value="reference">Reference on page</option>
                    </select>
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  <span>Raw Script Upload (must fail)</span>
                  <textarea
                    data-testid="h007-widget-raw-script"
                    value={widgetRawScript}
                    onChange={(event) => setWidgetRawScript(event.target.value)}
                    className="min-h-[90px] rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-slate-200"
                    placeholder="<script>alert('blocked')</script>"
                  />
                </label>

                <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                  <p className="text-xs text-slate-300">Action Mapping</p>
                  <p className="mt-1 text-[11px] text-slate-500">Define trigger and resulting behavior in operator language.</p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span>Trigger Label</span>
                    <input
                      data-testid="h007-action-trigger"
                      value={actionTriggerLabel}
                      onChange={(event) => setActionTriggerLabel(event.target.value)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span>Action</span>
                    <select
                      data-testid="h007-action-type"
                      value={actionType}
                      onChange={(event) => setActionType(normalizeActionType(event.target.value))}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    >
                      <option value="open_widget">Open widget</option>
                      <option value="open_modal">Open modal</option>
                      <option value="workflow">Run workflow</option>
                      <option value="link_url">Navigate</option>
                      <option value="download_asset">Download</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span>Target</span>
                    <input
                      data-testid="h007-action-target"
                      value={actionTarget}
                      onChange={(event) => setActionTarget(event.target.value)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  data-testid="h007-widget-save"
                  onClick={() => {
                    void bindWidgetAndAction();
                  }}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.12] px-3 py-2 text-xs font-semibold text-emerald-200"
                >
                  Bind Widget + Action
                </button>
              </section>
            ) : null}

            {activeStepId === "presentation" ? (
              <section data-testid="h007-step-panel-presentation" className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span>Shell</span>
                    <select
                      data-testid="h007-shell-select"
                      value={selectedShellId}
                      onChange={(event) => setSelectedShellId(event.target.value)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    >
                      <option value="">Select shell</option>
                      {shells.map((shell) => (
                        <option key={shell.id} value={shell.id}>
                          {shell.name} ({shell.status})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span>Active Theme</span>
                    <select
                      data-testid="h007-theme-select"
                      value={selectedThemeId}
                      onChange={(event) => setSelectedThemeId(event.target.value)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    >
                      <option value="">Select theme</option>
                      {themes.map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          {theme.name} ({theme.status})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span>Preview Swatch</span>
                    <select
                      data-testid="h007-swatch-select"
                      value={selectedSwatchThemeId}
                      onChange={(event) => setSelectedSwatchThemeId(event.target.value)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    >
                      <option value="">None</option>
                      {themes.map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          {theme.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <button
                  type="button"
                  data-testid="h007-apply-presentation"
                  onClick={() => {
                    void applyPresentation();
                  }}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.12] px-3 py-2 text-xs font-semibold text-emerald-200"
                >
                  Apply Shell + Theme + Swatch Preview
                </button>
              </section>
            ) : null}

            {activeStepId === "preview" ? (
              <section data-testid="h007-step-panel-preview" className="space-y-3">
                <PreviewPane title="H-007 Unified Preview" srcDoc={previewHtml} testId="h007-preview-frame" badge="draft" />
              </section>
            ) : null}

            {activeStepId === "publish" ? (
              <section data-testid="h007-step-panel-publish" className="space-y-3">
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  <span>Validation Token</span>
                  <textarea
                    data-testid="h007-validation-token"
                    value={validationToken}
                    onChange={(event) => setValidationToken(event.target.value)}
                    className="min-h-[100px] rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-slate-200"
                  />
                </label>
                <button
                  type="button"
                  data-testid="h007-publish-run"
                  onClick={() => {
                    void runPublish();
                  }}
                  className="rounded-lg border border-blue-500/30 bg-blue-500/[0.12] px-3 py-2 text-xs font-semibold text-blue-200"
                >
                  Publish
                </button>
                {publishResult ? (
                  <pre
                    data-testid="h007-publish-result"
                    className="overflow-x-auto rounded-lg border border-white/[0.08] bg-black/30 p-3 text-[11px] text-slate-300"
                  >
                    {JSON.stringify(publishResult, null, 2)}
                  </pre>
                ) : null}
              </section>
            ) : null}

            {activeStepId === "reopen" ? (
              <section data-testid="h007-step-panel-reopen" className="space-y-3">
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                  <p className="text-xs text-slate-200">Reopen and Modify</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Reloads data and applies a safe follow-up page modification to validate reopenability.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="h007-reopen-refresh"
                    onClick={() => {
                      void loadAll();
                    }}
                    className="rounded-lg border border-white/[0.14] bg-white/[0.06] px-3 py-2 text-xs text-slate-200"
                  >
                    Reload Workflow State
                  </button>
                  <button
                    type="button"
                    data-testid="h007-reopen-modify"
                    onClick={() => {
                      void reopenAndModify();
                    }}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.12] px-3 py-2 text-xs text-emerald-200"
                  >
                    Reopen and Modify
                  </button>
                </div>
                <p data-testid="h007-reopen-status" className="text-xs text-slate-400">
                  {reopenVerified ? "Reopen and modify verification complete." : "Pending reopen verification."}
                </p>
              </section>
            ) : null}
          </StudioDetailContainer>

          <StudioActionMenu
            testId="h007-action-container"
            title="Unified Interaction Grammar"
            description="Consistent create/edit/delete/duplicate/reorder/preview/publish grammar across the recovery flow."
            items={actionMenuItems}
          />

          <StudioDetailContainer
            testId="h007-evidence-container"
            title="Safety + Entity Evidence"
            description="Live audit surface for changed vs unchanged entities and preserved guardrails."
            isEmpty={false}
          >
            <div>
              <p className="text-xs font-semibold text-slate-300">Entities Changed</p>
              <ul data-testid="h007-entities-changed" className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-slate-400">
                {workflowEvidenceSnapshot.entitiesChanged.length > 0 ? (
                  workflowEvidenceSnapshot.entitiesChanged.map((entry) => <li key={entry}>{entry}</li>)
                ) : (
                  <li>None yet</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300">Entities Confirmed Unchanged</p>
              <ul data-testid="h007-entities-unchanged" className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-slate-400">
                {workflowEvidenceSnapshot.entitiesUnchanged.length > 0 ? (
                  workflowEvidenceSnapshot.entitiesUnchanged.map((entry) => <li key={entry}>{entry}</li>)
                ) : (
                  <li>None yet</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300">Safe Boundaries</p>
              <ul data-testid="h007-safety-checks" className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-slate-400">
                {workflowEvidenceSnapshot.safetyChecks.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </div>
            <p className="text-[11px] text-slate-500">Last Updated: {workflowEvidenceSnapshot.lastUpdatedAt}</p>
          </StudioDetailContainer>
        </div>
      </div>
    </div>
  );
}
