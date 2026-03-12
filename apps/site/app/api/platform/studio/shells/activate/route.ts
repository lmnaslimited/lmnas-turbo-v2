import type { StudioShell } from "../../../../../platform/onboarding/_lib/studio-types";
import { getStudioStore, replaceStore } from "../../_lib/store";
import { isStrapiConfigured, requestStrapi, StudioApiError, unwrapStrapiEntity } from "../../_lib/strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

type StrapiSchemaSource = "canonical" | "legacy";

const CANONICAL_SHELL_COLLECTION = "/api/studio-shells";
const LEGACY_SHELL_COLLECTION = "/api/shell-variants";

function resolveEntityMutationId(value: Record<string, unknown>): string | null {
  if (typeof value.documentId === "string" && value.documentId.length > 0) {
    return value.documentId;
  }
  if (typeof value.id === "string" || typeof value.id === "number") {
    return String(value.id);
  }
  return null;
}

function mapMenuItemsFromStrapi(items: unknown): StudioShell["menuItems"] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const row = item as Record<string, unknown>;
      const childrenRaw = Array.isArray(row.submenuItems) ? row.submenuItems : [];
      const children = childrenRaw
        .map((child, childIndex) => {
          if (!child || typeof child !== "object" || Array.isArray(child)) {
            return null;
          }
          const childRow = child as Record<string, unknown>;
          return {
            id: `${String(row.label ?? `item-${index + 1}`)}-child-${childIndex + 1}`,
            label: typeof childRow.label === "string" ? childRow.label : `Child ${childIndex + 1}`,
            href: typeof childRow.href === "string" ? childRow.href : "#"
          };
        })
        .filter((entry): entry is StudioShell["menuItems"][number] => entry !== null);

      return {
        id: String(row.id ?? row.label ?? `item-${index + 1}`),
        label: typeof row.label === "string" ? row.label : `Item ${index + 1}`,
        href: typeof row.href === "string" ? row.href : "#",
        ...(children.length > 0 ? { children } : {})
      };
    })
    .filter((entry): entry is StudioShell["menuItems"][number] => entry !== null);
}

function mapShellActions(actions: unknown): StudioShell["actions"] {
  if (!Array.isArray(actions)) {
    return [];
  }

  return actions
    .map((action, index) => {
      if (!action || typeof action !== "object" || Array.isArray(action)) {
        return null;
      }
      const row = action as Record<string, unknown>;
      const type = row.type;
      const normalizedType =
        type === "link_url" || type === "scroll_to_section" || type === "open_modal" || type === "open_drawer"
          ? type
          : "link_url";

      return {
        id: typeof row.id === "string" ? row.id : `action-${index + 1}`,
        label: typeof row.label === "string" ? row.label : `Action ${index + 1}`,
        type: normalizedType,
        target: typeof row.target === "string" ? row.target : "/"
      };
    })
    .filter((entry): entry is StudioShell["actions"][number] => entry !== null);
}

function normalizeBlockArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function normalizeShellFromCanonical(value: unknown): StudioShell {
  const row = (value ?? {}) as Record<string, unknown>;
  const rawId = row.documentId ?? row.id;
  const resolvedId = typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : `shell-${Date.now()}`;
  return {
    id: resolvedId,
    key: typeof row.shellKey === "string" ? row.shellKey : "shell",
    name: typeof row.name === "string" ? row.name : "Shell",
    role: row.role === "navbar" || row.role === "footer" ? row.role : "full",
    status: row.status === "active" ? "active" : "inactive",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    menuItems: mapMenuItemsFromStrapi(row.menuItems),
    actions: mapShellActions(row.actions),
    navbarBlocks: normalizeBlockArray(row.navbarBlocks),
    footerBlocks: normalizeBlockArray(row.footerBlocks),
    previewHtml: typeof row.previewHtml === "string" ? row.previewHtml : "<div>No preview</div>"
  };
}

function normalizeShellFromLegacy(value: unknown): StudioShell {
  const row = (value ?? {}) as Record<string, unknown>;
  const rawId = row.documentId ?? row.id;
  const shell =
    row.shell && typeof row.shell === "object" && !Array.isArray(row.shell) ? (row.shell as Record<string, unknown>) : {};
  const navbarVariant =
    shell.navbarVariant && typeof shell.navbarVariant === "object" && !Array.isArray(shell.navbarVariant)
      ? (shell.navbarVariant as Record<string, unknown>)
      : {};
  const menu =
    navbarVariant.menu && typeof navbarVariant.menu === "object" && !Array.isArray(navbarVariant.menu)
      ? (navbarVariant.menu as Record<string, unknown>)
      : {};
  const resolvedId = typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : `shell-${Date.now()}`;
  return {
    id: resolvedId,
    key: typeof row.variantKey === "string" ? row.variantKey : "shell",
    name: typeof shell.title === "string" ? shell.title : "Shell",
    role: row.role === "navbar" || row.role === "footer" ? row.role : "full",
    status: row.status === "active" ? "active" : "inactive",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    menuItems: mapMenuItemsFromStrapi(menu.items),
    actions: mapShellActions(row.actions),
    navbarBlocks: normalizeBlockArray(row.navbarBlocks ?? shell.navbarBlocks),
    footerBlocks: normalizeBlockArray(row.footerBlocks ?? shell.footerBlocks),
    previewHtml: typeof row.previewHtml === "string" ? row.previewHtml : "<div>No preview</div>"
  };
}

async function listShellsFromCollection(
  collectionPath: string,
  mapper: (value: unknown) => StudioShell
): Promise<Array<{ raw: Record<string, unknown>; normalized: StudioShell }>> {
  const all = await requestStrapi<StrapiCollectionResponse>(`${collectionPath}?pagination[pageSize]=200&populate=*`);
  const rows = Array.isArray(all.data) ? all.data : [];
  return rows.map((row) => ({ raw: row, normalized: mapper(unwrapStrapiEntity(row)) }));
}

async function activateInCollection(
  collectionPath: string,
  shellId: string,
  shellKey: string | undefined,
  mapper: (value: unknown) => StudioShell
): Promise<StudioShell[]> {
  const rows = await listShellsFromCollection(collectionPath, mapper);
  const selected = rows.find(({ normalized }) => normalized.id === shellId || (shellKey && normalized.key === shellKey));
  const selectedRole = selected?.normalized.role;

  for (const { raw, normalized } of rows) {
    const mutationId = resolveEntityMutationId(raw);
    if (!mutationId) {
      continue;
    }

    const sameRole = selectedRole === undefined ? true : normalized.role === selectedRole;
    const shouldActivate = normalized.id === shellId || (shellKey && normalized.key === shellKey);
    const status = shouldActivate ? "active" : sameRole ? "inactive" : normalized.status;
    await requestStrapi(`${collectionPath}/${encodeURIComponent(mutationId)}`, {
      method: "PUT",
      body: { status }
    });
  }

  const refreshed = await listShellsFromCollection(collectionPath, mapper);
  return refreshed.map((row) => row.normalized);
}

async function activateInStrapi(
  shellId: string,
  shellKey: string | undefined
): Promise<{ shells: StudioShell[]; schemaSource: StrapiSchemaSource }> {
  try {
    const shells = await activateInCollection(CANONICAL_SHELL_COLLECTION, shellId, shellKey, normalizeShellFromCanonical);
    return {
      shells,
      schemaSource: "canonical"
    };
  } catch {
    const shells = await activateInCollection(LEGACY_SHELL_COLLECTION, shellId, shellKey, normalizeShellFromLegacy);
    return {
      shells,
      schemaSource: "legacy"
    };
  }
}

function activateInFallback(shellId: string): StudioShell[] {
  const store = getStudioStore();
  const selected = store.shells.find((shell) => shell.id === shellId);
  const selectedRole = selected?.role;
  const shells = store.shells.map((shell) => ({
    ...shell,
    status: shell.id === shellId ? "active" : selectedRole && shell.role === selectedRole ? "inactive" : shell.status,
    updatedAt: new Date().toISOString().slice(0, 10)
  }));

  replaceStore({
    ...store,
    shells
  });
  return shells;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as { id?: string; key?: string };
    const shellId = payload.id?.trim();
    const shellKey = payload.key?.trim();
    if (!shellId) {
      return Response.json(
        {
          ok: false,
          error: "Shell id is required."
        },
        { status: 400 }
      );
    }

    if (isStrapiConfigured()) {
      try {
        const { shells, schemaSource } = await activateInStrapi(shellId, shellKey);
        return Response.json({
          ok: true,
          data: shells,
          source: "strapi",
          schemaSource
        });
      } catch {
        const fallback = activateInFallback(shellId);
        return Response.json({
          ok: true,
          data: fallback,
          source: "fallback",
          schemaSource: "fallback"
        });
      }
    }

    const fallback = activateInFallback(shellId);
    return Response.json({
      ok: true,
      data: fallback,
      source: "fallback",
      schemaSource: "fallback"
    });
  } catch (error) {
    if (error instanceof StudioApiError) {
      return Response.json(
        {
          ok: false,
          error: error.operatorMessage,
          developerError: error.developerMessage
        },
        { status: error.status }
      );
    }

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 400 }
    );
  }
}
