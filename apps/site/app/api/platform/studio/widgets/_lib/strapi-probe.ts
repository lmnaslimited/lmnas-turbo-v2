import { isStrapiConfigured, requestStrapi } from "../../_lib/strapi";

type StrapiProbeResponse = {
  data?: unknown[];
  meta?: {
    pagination?: {
      total?: number;
    };
  };
};

export type StudioWidgetStrapiProbeSnapshot = {
  pages: number | null;
  blocks: number | null;
  shells: number | null;
  source: "strapi" | "unavailable";
  warnings: string[];
};

async function fetchEntityTotal(path: string): Promise<number | null> {
  const response = await requestStrapi<StrapiProbeResponse>(path);
  const total = response.meta?.pagination?.total;
  if (typeof total === "number" && Number.isFinite(total)) {
    return total;
  }
  if (Array.isArray(response.data)) {
    return response.data.length;
  }
  return null;
}

export async function collectWidgetStrapiProbeSnapshot(): Promise<StudioWidgetStrapiProbeSnapshot> {
  if (!isStrapiConfigured()) {
    return {
      pages: null,
      blocks: null,
      shells: null,
      source: "unavailable",
      warnings: ["Strapi is not configured in this environment."]
    };
  }

  const warnings: string[] = [];
  let pages: number | null = null;
  let blocks: number | null = null;
  let shells: number | null = null;

  try {
    pages = await fetchEntityTotal("/api/pages?pagination[pageSize]=1");
  } catch (error) {
    warnings.push(`pages_probe_failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    blocks = await fetchEntityTotal("/api/block-templates?pagination[pageSize]=1");
  } catch (error) {
    warnings.push(`blocks_probe_failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    shells = await fetchEntityTotal("/api/shell-variants?pagination[pageSize]=1");
  } catch (error) {
    warnings.push(`shells_probe_failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    pages,
    blocks,
    shells,
    source: "strapi",
    warnings
  };
}
