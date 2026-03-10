import type { StudioMenuItem, StudioShell, StudioShellAction } from "../../../../platform/onboarding/_lib/studio-types";
import { getStudioStore, replaceStore } from "../_lib/store";
import { isStrapiConfigured, requestStrapi, StudioApiError, unwrapStrapiEntity } from "../_lib/strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

function mapMenuItemsToStrapi(items: StudioMenuItem[]): Array<Record<string, unknown>> {
  return items.map((item) => ({
    label: item.label,
    href: item.href,
    destinationType: item.href.startsWith("http") ? "external" : "internal",
    destinationValue: item.href,
    submenuItems: Array.isArray(item.children)
      ? item.children.map((child) => ({
          label: child.label,
          href: child.href
        }))
      : []
  }));
}

function mapMenuItemsFromStrapi(items: unknown): StudioMenuItem[] {
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
        .filter((entry): entry is StudioMenuItem => entry !== null);

      return {
        id: String(row.id ?? row.label ?? `item-${index + 1}`),
        label: typeof row.label === "string" ? row.label : `Item ${index + 1}`,
        href: typeof row.href === "string" ? row.href : "#",
        ...(children.length > 0 ? { children } : {})
      };
    })
    .filter((entry): entry is StudioMenuItem => entry !== null);
}

function mapShellActions(actions: unknown): StudioShellAction[] {
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
      } as StudioShellAction;
    })
    .filter((action): action is StudioShellAction => action !== null);
}

function normalizeBlockArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function mapShellFromStrapi(value: unknown): StudioShell {
  const row = (value ?? {}) as Record<string, unknown>;
  const shell = row.shell && typeof row.shell === "object" && !Array.isArray(row.shell) ? (row.shell as Record<string, unknown>) : {};
  const navbarVariant =
    shell.navbarVariant && typeof shell.navbarVariant === "object" && !Array.isArray(shell.navbarVariant)
      ? (shell.navbarVariant as Record<string, unknown>)
      : {};
  const menu =
    navbarVariant.menu && typeof navbarVariant.menu === "object" && !Array.isArray(navbarVariant.menu)
      ? (navbarVariant.menu as Record<string, unknown>)
      : {};
  const menuItems = mapMenuItemsFromStrapi(menu.items);

  const rawId = row.documentId ?? row.id;
  const resolvedId = typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : `shell-${Date.now()}`;

  return {
    id: resolvedId,
    key: typeof row.variantKey === "string" ? row.variantKey : typeof shell.variantKey === "string" ? shell.variantKey : "shell",
    name: typeof shell.title === "string" ? shell.title : typeof row.variantKey === "string" ? row.variantKey : "Shell",
    role: row.role === "navbar" || row.role === "footer" ? row.role : "full",
    status: row.status === "active" ? "active" : "inactive",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    menuItems,
    actions: mapShellActions(row.actions),
    navbarBlocks: normalizeBlockArray(row.navbarBlocks ?? shell.navbarBlocks),
    footerBlocks: normalizeBlockArray(row.footerBlocks ?? shell.footerBlocks),
    previewHtml: typeof row.previewHtml === "string" && row.previewHtml.length > 0 ? row.previewHtml : "<div>No preview</div>"
  };
}

async function listShellsFromStrapi(): Promise<StudioShell[]> {
  const response = await requestStrapi<StrapiCollectionResponse>("/api/shell-variants?pagination[pageSize]=200&populate=*");
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map((row) => mapShellFromStrapi(unwrapStrapiEntity(row)));
}

async function upsertShellInStrapi(shell: StudioShell): Promise<void> {
  const lookup = await requestStrapi<StrapiCollectionResponse>(
    `/api/shell-variants?filters[variantKey][$eq]=${encodeURIComponent(shell.key)}&pagination[pageSize]=1`
  );
  const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  const existingId =
    existing && typeof existing.documentId === "string"
      ? existing.documentId
      : existing && (typeof existing.id === "number" || typeof existing.id === "string")
        ? String(existing.id)
        : undefined;

  const payload = {
    variantKey: shell.key,
    role: shell.role,
    status: shell.status,
    actions: shell.actions,
    navbarBlocks: shell.navbarBlocks,
    footerBlocks: shell.footerBlocks,
    previewHtml: shell.previewHtml,
    shell: {
      variantKey: shell.key,
      title: shell.name,
      description: `${shell.name} shell`,
      navbarBlocks: shell.navbarBlocks,
      footerBlocks: shell.footerBlocks,
      navbarVariant: {
        variantKey: `${shell.key}-navbar`,
        title: `${shell.name} Navbar`,
        menu: {
          menuKey: `menu-${shell.key}`,
          title: `${shell.name} Menu`,
          items: mapMenuItemsToStrapi(shell.menuItems),
          groups: []
        },
        sticky: true,
        mobileBehavior: "drawer",
        ctaSlotLabel: shell.actions[0]?.label
      },
      footerVariant: {
        variantKey: `${shell.key}-footer`,
        title: `${shell.name} Footer`,
        columns: [],
        legalStrip: {
          copyrightText: "© LMNAs",
          legalLinks: []
        }
      }
    }
  };

  if (existingId !== undefined) {
    await requestStrapi(`/api/shell-variants/${encodeURIComponent(existingId)}`, {
      method: "PUT",
      body: payload
    });
    return;
  }

  await requestStrapi("/api/shell-variants", {
    method: "POST",
    body: payload
  });
}

function upsertShellInFallback(shell: StudioShell): StudioShell[] {
  const store = getStudioStore();
  const shells = [...store.shells];
  const index = shells.findIndex((candidate) => candidate.id === shell.id || candidate.key === shell.key);
  const next = {
    ...shell,
    updatedAt: new Date().toISOString().slice(0, 10)
  };

  if (index >= 0) {
    shells[index] = next;
  } else {
    shells.unshift(next);
  }

  if (next.status === "active") {
    shells.forEach((candidate) => {
      if (candidate.id !== next.id) {
        candidate.status = "inactive";
      }
    });
  }

  replaceStore({
    ...store,
    shells
  });
  return shells;
}

function normalizeShell(value: unknown): StudioShell {
  const row = (value ?? {}) as Record<string, unknown>;
  const menuItems = Array.isArray(row.menuItems) ? (row.menuItems as StudioMenuItem[]) : [];
  const actions = Array.isArray(row.actions) ? mapShellActions(row.actions) : [];
  const navbarBlocks = normalizeBlockArray(row.navbarBlocks);
  const footerBlocks = normalizeBlockArray(row.footerBlocks);
  return {
    id: typeof row.id === "string" && row.id.length > 0 ? row.id : `shell-${Date.now()}`,
    key: typeof row.key === "string" && row.key.length > 0 ? row.key : `shell-${Date.now()}`,
    name: typeof row.name === "string" && row.name.length > 0 ? row.name : "Shell",
    role: row.role === "navbar" || row.role === "footer" ? row.role : "full",
    status: row.status === "active" ? "active" : "inactive",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    menuItems,
    actions,
    navbarBlocks,
    footerBlocks,
    previewHtml: typeof row.previewHtml === "string" && row.previewHtml.length > 0 ? row.previewHtml : "<div>No preview</div>"
  };
}

export async function GET(): Promise<Response> {
  if (isStrapiConfigured()) {
    try {
      const shells = await listShellsFromStrapi();
      if (shells.length > 0) {
        return Response.json({
          ok: true,
          data: shells,
          source: "strapi"
        });
      }
    } catch {
      // fall back
    }
  }

  return Response.json({
    ok: true,
    data: getStudioStore().shells,
    source: "fallback"
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as { shell?: unknown };
    const shell = normalizeShell(payload.shell);

    if (isStrapiConfigured()) {
      try {
        await upsertShellInStrapi(shell);
        const shells = await listShellsFromStrapi();
        return Response.json({
          ok: true,
          data: shells,
          source: "strapi"
        });
      } catch {
        const fallbackShells = upsertShellInFallback(shell);
        return Response.json({
          ok: true,
          data: fallbackShells,
          source: "fallback"
        });
      }
    }

    const fallbackShells = upsertShellInFallback(shell);
    return Response.json({
      ok: true,
      data: fallbackShells,
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
