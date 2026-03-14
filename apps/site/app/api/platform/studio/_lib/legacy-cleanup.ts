import { loadProjectEnv } from "../../../../lib/env";
import { requestStrapi, StudioApiError, unwrapStrapiEntity } from "./strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

type StrapiBlockRecord = Record<string, unknown> & {
  __component?: string;
};

type StrapiPageRecord = {
  entryId: string;
  id: string;
  apiId: string;
  slug: string;
  locale: string;
  blocks: StrapiBlockRecord[];
};

export type LegacyBlockTemplateSnapshot = {
  id: string;
  templateKey: string;
  family: string;
};

export type LegacyPageSnapshot = {
  id: string;
  slug: string;
  locale: string;
  totalBlocks: number;
  legacyBlockCount: number;
};

export type LegacyPageMutationSnapshot = {
  id: string;
  slug: string;
  locale: string;
  removedLegacyBlocks: number;
  totalBlocksAfter: number;
};

export type LegacyStudioCleanupReport = {
  executedAt: string;
  blockTemplates: {
    before: LegacyBlockTemplateSnapshot[];
    deletedIds: string[];
    after: LegacyBlockTemplateSnapshot[];
  };
  pages: {
    before: LegacyPageSnapshot[];
    updated: LegacyPageMutationSnapshot[];
    after: LegacyPageSnapshot[];
  };
  sterile: boolean;
};

const LEGACY_FAMILIES = new Set(["faq", "hero"]);
const LEGACY_COMPONENT_TYPES = new Set(["blocks.faq", "blocks.hero"]);
const QUERY_TIMEOUT_MS = 2_500;
const MUTATION_TIMEOUT_MS = 10_000;

function resolveEntryId(value: Record<string, unknown>): string {
  const candidate = value.id;
  if (typeof candidate === "string" && candidate.length > 0) {
    return candidate;
  }
  if (typeof candidate === "number") {
    return String(candidate);
  }
  return "";
}

function resolveDocumentId(value: Record<string, unknown>): string {
  const candidate = value.documentId;
  if (typeof candidate === "string" && candidate.length > 0) {
    return candidate;
  }
  return resolveEntryId(value);
}

function parseBlocks(value: unknown): StrapiBlockRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is StrapiBlockRecord => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
}

function isLegacyBlock(block: StrapiBlockRecord): boolean {
  return typeof block.__component === "string" && LEGACY_COMPONENT_TYPES.has(block.__component);
}

function toPageSnapshot(page: StrapiPageRecord): LegacyPageSnapshot {
  return {
    id: page.id,
    slug: page.slug,
    locale: page.locale,
    totalBlocks: page.blocks.length,
    legacyBlockCount: page.blocks.filter((block) => isLegacyBlock(block)).length
  };
}

async function assertStrapiReachable(): Promise<void> {
  await requestStrapi<StrapiCollectionResponse>("/api/block-templates?pagination[pageSize]=1&fields[0]=templateKey", {
    timeoutMs: QUERY_TIMEOUT_MS
  });
}

async function listLegacyBlockTemplates(): Promise<LegacyBlockTemplateSnapshot[]> {
  const response = await requestStrapi<StrapiCollectionResponse>(
    "/api/block-templates?pagination[pageSize]=200&fields[0]=templateKey&fields[1]=family&filters[$or][0][family][$eq]=faq&filters[$or][1][family][$eq]=hero",
    {
      timeoutMs: QUERY_TIMEOUT_MS
    }
  );
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows
    .map((entry) => {
      const row = unwrapStrapiEntity(entry);
      const family = typeof row.family === "string" ? row.family : "";
      const id = resolveDocumentId(row);
      return {
        id,
        templateKey: typeof row.templateKey === "string" ? row.templateKey : "",
        family
      };
    })
    .filter((row) => row.id.length > 0 && row.templateKey.length > 0 && LEGACY_FAMILIES.has(row.family));
}

async function deleteTemplateById(id: string): Promise<void> {
  await requestStrapi(`/api/block-templates/${encodeURIComponent(id)}`, {
    method: "DELETE",
    timeoutMs: MUTATION_TIMEOUT_MS
  });
}

async function listPages(): Promise<StrapiPageRecord[]> {
  const response = await requestStrapi<StrapiCollectionResponse>(
    "/api/pages?pagination[pageSize]=200&fields[0]=slug&populate[blocks][populate]=*",
    {
      timeoutMs: QUERY_TIMEOUT_MS
    }
  );

  const rows = Array.isArray(response.data) ? response.data : [];
  return rows
    .map((entry) => {
      const row = unwrapStrapiEntity(entry);
      const entryId = resolveEntryId(row);
      const id = resolveDocumentId(row);
      return {
        entryId,
        id,
        apiId: id,
        slug: typeof row.slug === "string" ? row.slug : "",
        locale: typeof row.locale === "string" ? row.locale : "en",
        blocks: parseBlocks(row.blocks)
      };
    })
    .filter((row) => row.apiId.length > 0 || row.entryId.length > 0);
}

async function deletePageByIdentifier(identifier: string): Promise<void> {
  await requestStrapi(`/api/pages/${encodeURIComponent(identifier)}`, {
    method: "DELETE",
    timeoutMs: MUTATION_TIMEOUT_MS
  });
}

async function deletePageWithFallbackIdentifier(page: StrapiPageRecord): Promise<void> {
  const firstIdentifier = page.apiId.length > 0 ? page.apiId : page.entryId;
  const fallbackIdentifier = page.entryId.length > 0 ? page.entryId : page.apiId;

  try {
    await deletePageByIdentifier(firstIdentifier);
  } catch (error) {
    if (
      error instanceof StudioApiError &&
      error.status === 404 &&
      fallbackIdentifier.length > 0 &&
      fallbackIdentifier !== firstIdentifier
    ) {
      await deletePageByIdentifier(fallbackIdentifier);
      return;
    }
    throw error;
  }
}

export function isLegacyWipeEnabled(): boolean {
  loadProjectEnv();
  return process.env.STUDIO_ENABLE_LEGACY_WIPE === "1";
}

export async function wipeLegacyStudioEntries(): Promise<LegacyStudioCleanupReport> {
  await assertStrapiReachable();

  const beforeTemplates = await listLegacyBlockTemplates();
  const pagesBefore = await listPages();

  const deletedIds: string[] = [];
  for (const template of beforeTemplates) {
    await deleteTemplateById(template.id);
    deletedIds.push(template.id);
  }

  const updatedPages: LegacyPageMutationSnapshot[] = [];
  for (const page of pagesBefore) {
    const removedLegacyBlocks = page.blocks.filter((block) => isLegacyBlock(block)).length;
    if (removedLegacyBlocks <= 0) {
      continue;
    }

    await deletePageWithFallbackIdentifier(page);
    updatedPages.push({
      id: page.id,
      slug: page.slug,
      locale: page.locale,
      removedLegacyBlocks,
      totalBlocksAfter: 0
    });
  }

  const afterTemplates = await listLegacyBlockTemplates();
  const pagesAfter = await listPages();
  const beforeSnapshots = pagesBefore.map(toPageSnapshot);
  const afterSnapshots = pagesAfter.map(toPageSnapshot);

  return {
    executedAt: new Date().toISOString(),
    blockTemplates: {
      before: beforeTemplates,
      deletedIds,
      after: afterTemplates
    },
    pages: {
      before: beforeSnapshots,
      updated: updatedPages,
      after: afterSnapshots
    },
    sterile: afterTemplates.length === 0 && afterSnapshots.every((page) => page.legacyBlockCount === 0)
  };
}
