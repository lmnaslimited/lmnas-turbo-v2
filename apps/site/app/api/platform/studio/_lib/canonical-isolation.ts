import { readStoreSnapshot } from "./store";
import { requestStrapi } from "./strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

export type CanonicalCollectionKey = "themes" | "shells" | "blocks" | "widgets" | "pages";

type CanonicalCollectionConfig = {
  key: CanonicalCollectionKey;
  endpoint: string;
};

type CanonicalCollectionReport = {
  key: CanonicalCollectionKey;
  endpoint: string;
  before: number;
  deleted: number;
  seeded: number;
  after: number;
};

export type CanonicalIsolationReport = {
  executedAt: string;
  collections: CanonicalCollectionReport[];
  sterile: boolean;
};

const CANONICAL_COLLECTIONS: CanonicalCollectionConfig[] = [
  { key: "themes", endpoint: "/api/studio-themes" },
  { key: "shells", endpoint: "/api/studio-shells" },
  { key: "blocks", endpoint: "/api/studio-blocks" },
  { key: "widgets", endpoint: "/api/studio-widgets" },
  { key: "pages", endpoint: "/api/studio-pages" }
];

function resolveEntityMutationId(value: Record<string, unknown>): string | null {
  if (typeof value.documentId === "string" && value.documentId.length > 0) {
    return value.documentId;
  }
  if (typeof value.id === "string" || typeof value.id === "number") {
    return String(value.id);
  }
  return null;
}

async function listEntries(endpoint: string): Promise<Array<Record<string, unknown>>> {
  const response = await requestStrapi<StrapiCollectionResponse>(`${endpoint}?pagination[pageSize]=500`);
  return Array.isArray(response.data) ? response.data : [];
}

async function deleteAllEntries(endpoint: string): Promise<number> {
  const rows = await listEntries(endpoint);
  let deleted = 0;
  for (const row of rows) {
    const id = resolveEntityMutationId(row);
    if (!id) {
      continue;
    }
    await requestStrapi(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
    deleted += 1;
  }
  return deleted;
}

async function seedCanonicalThemes(): Promise<number> {
  const snapshot = readStoreSnapshot();
  let seeded = 0;
  for (const theme of snapshot.themes) {
    await requestStrapi("/api/studio-themes", {
      method: "POST",
      body: {
        themeKey: theme.themeKey,
        name: theme.name,
        status: theme.status,
        sourceRef: theme.sourceRef,
        tokenCoverage: theme.tokenCoverage,
        themeDebt: theme.themeDebt,
        darkMode: theme.darkMode,
        tokens: theme.tokens
      }
    });
    seeded += 1;
  }
  return seeded;
}

async function seedCanonicalShells(): Promise<number> {
  const snapshot = readStoreSnapshot();
  let seeded = 0;
  for (const shell of snapshot.shells) {
    await requestStrapi("/api/studio-shells", {
      method: "POST",
      body: {
        shellKey: shell.key,
        name: shell.name,
        role: shell.role,
        status: shell.status,
        menuItems: shell.menuItems,
        actions: shell.actions,
        navbarBlocks: shell.navbarBlocks,
        footerBlocks: shell.footerBlocks,
        previewHtml: shell.previewHtml
      }
    });
    seeded += 1;
  }
  return seeded;
}

async function seedCanonicalBlocks(): Promise<number> {
  const snapshot = readStoreSnapshot();
  let seeded = 0;
  for (const block of snapshot.blocks) {
    await requestStrapi("/api/studio-blocks", {
      method: "POST",
      body: {
        blockKey: block.key,
        name: block.name,
        family: block.family,
        status: block.status,
        lifecycle: block.lifecycle ?? "draft",
        scope: block.scope ?? "global",
        schemaStatus: block.schemaStatus ?? "valid",
        themeKey: block.themeKey,
        sourceType: block.sourceType,
        sourceRef: block.sourceRef,
        confidence: block.confidence,
        editableFields: block.editableFields,
        actions: block.actions,
        previewHtml: block.previewHtml,
        usageCount: block.usageCount ?? block.inUseCount,
        productMapping: "",
        industryMapping: []
      }
    });
    seeded += 1;
  }
  return seeded;
}

async function seedCanonicalWidgets(): Promise<number> {
  const snapshot = readStoreSnapshot();
  let seeded = 0;
  for (const widget of snapshot.widgets) {
    await requestStrapi("/api/studio-widgets", {
      method: "POST",
      body: {
        widgetKey: widget.key,
        name: widget.name,
        widgetType: widget.widgetType,
        surface: widget.surface,
        status: widget.status,
        lifecycle: widget.lifecycle ?? "draft",
        readiness: widget.readiness ?? "ready",
        repoPath: widget.repoPath,
        description: widget.description,
        editableFields: widget.editableFields,
        defaultExitId: widget.defaultExitId,
        visualMockHtml: widget.visualMockHtml,
        placement: widget.placement
      }
    });
    seeded += 1;
  }
  return seeded;
}

async function seedCanonicalPages(): Promise<number> {
  const snapshot = readStoreSnapshot();
  let seeded = 0;
  for (const page of snapshot.pages) {
    await requestStrapi("/api/studio-pages", {
      method: "POST",
      body: {
        pageKey: page.id,
        name: page.name,
        slug: page.slug,
        locale: page.locale,
        status: page.status ?? "draft",
        lifecycle: page.lifecycle ?? "draft",
        activeShellId: page.activeShellId,
        shellKey: page.shellKey,
        blockOrder: page.blockOrder,
        fieldValues: page.fieldValues,
        actionOverrides: page.actionOverrides,
        productMapping: page.productMapping,
        industryMapping: page.industryMapping,
        primaryCta: page.primaryCta,
        conversionConfig: page.conversionConfig,
        campaignUtmStrategy: page.campaignUtmStrategy,
        taxonomyState: page.taxonomyState,
        seoMetadata: page.seoMetadata,
        seoJsonLdValid: page.seoJsonLdValid,
        blockSchemaValid: page.blockSchemaValid,
        previewValid: page.previewValid,
        previewHtml: page.previewHtml
      }
    });
    seeded += 1;
  }
  return seeded;
}

async function seedCanonicalCollection(key: CanonicalCollectionKey): Promise<number> {
  if (key === "themes") {
    return seedCanonicalThemes();
  }
  if (key === "shells") {
    return seedCanonicalShells();
  }
  if (key === "blocks") {
    return seedCanonicalBlocks();
  }
  if (key === "widgets") {
    return seedCanonicalWidgets();
  }
  return seedCanonicalPages();
}

export async function resetCanonicalStudioSchema(): Promise<CanonicalIsolationReport> {
  const reports: CanonicalCollectionReport[] = [];

  for (const collection of CANONICAL_COLLECTIONS) {
    const beforeRows = await listEntries(collection.endpoint);
    const deleted = await deleteAllEntries(collection.endpoint);
    const seeded = await seedCanonicalCollection(collection.key);
    const afterRows = await listEntries(collection.endpoint);

    reports.push({
      key: collection.key,
      endpoint: collection.endpoint,
      before: beforeRows.length,
      deleted,
      seeded,
      after: afterRows.length
    });
  }

  return {
    executedAt: new Date().toISOString(),
    collections: reports,
    sterile: reports.every((report) => report.after >= 1)
  };
}
