import type { StudioShell } from "../../../../../platform/onboarding/_lib/studio-types";
import { getStudioStore, replaceStore } from "../../_lib/store";
import { isStrapiConfigured, requestStrapi, StudioApiError, unwrapStrapiEntity } from "../../_lib/strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

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

function normalizeShell(value: unknown): StudioShell {
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

async function activateInStrapi(shellId: string, shellKey?: string): Promise<StudioShell[]> {
  const all = await requestStrapi<StrapiCollectionResponse>("/api/shell-variants?pagination[pageSize]=200&populate=*");
  const rows = Array.isArray(all.data) ? all.data : [];
  const selected = rows.find((row) => {
    const current = unwrapStrapiEntity(row) as Record<string, unknown>;
    if (String(current.id) === shellId) {
      return true;
    }
    return typeof shellKey === "string" && shellKey.length > 0 && current.variantKey === shellKey;
  });
  const selectedRole = selected ? (unwrapStrapiEntity(selected) as Record<string, unknown>).role : undefined;

  for (const row of rows) {
    const normalized = unwrapStrapiEntity(row);
    const strapiId =
      typeof row.documentId === "string"
        ? row.documentId
        : typeof row.id === "number" || typeof row.id === "string"
          ? String(row.id)
          : undefined;
    if (strapiId === undefined) {
      continue;
    }

    const sameRole = normalized.role === selectedRole || (selectedRole === undefined && true);
    const shouldActivate =
      normalized.id === shellId ||
      (typeof shellKey === "string" && shellKey.length > 0 && normalized.variantKey === shellKey);
    const status = shouldActivate ? "active" : sameRole ? "inactive" : normalized.status;
    await requestStrapi(`/api/shell-variants/${encodeURIComponent(strapiId)}`, {
      method: "PUT",
      body: { status }
    });
  }

  const refreshed = await requestStrapi<StrapiCollectionResponse>("/api/shell-variants?pagination[pageSize]=200&populate=*");
  return (Array.isArray(refreshed.data) ? refreshed.data : []).map((row) => normalizeShell(unwrapStrapiEntity(row)));
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
        const shells = await activateInStrapi(shellId, shellKey);
        return Response.json({
          ok: true,
          data: shells,
          source: "strapi"
        });
      } catch {
        const fallback = activateInFallback(shellId);
        return Response.json({
          ok: true,
          data: fallback,
          source: "fallback"
        });
      }
    }

    const fallback = activateInFallback(shellId);
    return Response.json({
      ok: true,
      data: fallback,
      source: "fallback"
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
