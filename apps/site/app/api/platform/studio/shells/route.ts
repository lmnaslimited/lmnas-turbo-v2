import type { StudioMenuItem, StudioShell, StudioShellAction } from "../../../../platform/onboarding/_lib/studio-types";
import { getStudioStore, replaceStore } from "../_lib/store";
import { isStrapiConfigured, requestStrapi, StudioApiError, unwrapStrapiEntity } from "../_lib/strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

type StrapiSchemaSource = "canonical" | "legacy";

const CANONICAL_SHELL_COLLECTION = "/api/studio-shells";
const LEGACY_SHELL_COLLECTION = "/api/shell-variants";

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

function mapMenuItemsFromCanonical(items: unknown): StudioMenuItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const row = item as Record<string, unknown>;
      const childrenRaw = Array.isArray(row.children) ? row.children : Array.isArray(row.submenuItems) ? row.submenuItems : [];
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

function mapMenuItemsFromLegacy(items: unknown): StudioMenuItem[] {
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

function mapShellFromCanonical(value: unknown): StudioShell {
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
    menuItems: mapMenuItemsFromCanonical(row.menuItems),
    actions: mapShellActions(row.actions),
    navbarBlocks: normalizeBlockArray(row.navbarBlocks),
    footerBlocks: normalizeBlockArray(row.footerBlocks),
    previewHtml: typeof row.previewHtml === "string" && row.previewHtml.length > 0 ? row.previewHtml : "<div>No preview</div>"
  };
}

function mapShellFromLegacy(value: unknown): StudioShell {
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

  const rawId = row.documentId ?? row.id;
  const resolvedId = typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : `shell-${Date.now()}`;

  return {
    id: resolvedId,
    key: typeof row.variantKey === "string" ? row.variantKey : typeof shell.variantKey === "string" ? shell.variantKey : "shell",
    name: typeof shell.title === "string" ? shell.title : typeof row.variantKey === "string" ? row.variantKey : "Shell",
    role: row.role === "navbar" || row.role === "footer" ? row.role : "full",
    status: row.status === "active" ? "active" : "inactive",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    menuItems: mapMenuItemsFromLegacy(menu.items),
    actions: mapShellActions(row.actions),
    navbarBlocks: normalizeBlockArray(row.navbarBlocks ?? shell.navbarBlocks),
    footerBlocks: normalizeBlockArray(row.footerBlocks ?? shell.footerBlocks),
    previewHtml: typeof row.previewHtml === "string" && row.previewHtml.length > 0 ? row.previewHtml : "<div>No preview</div>"
  };
}

async function listShellsFromCollection(
  collectionPath: string,
  mapper: (value: unknown) => StudioShell
): Promise<StudioShell[]> {
  const response = await requestStrapi<StrapiCollectionResponse>(`${collectionPath}?pagination[pageSize]=200&populate=*`);
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map((row) => mapper(unwrapStrapiEntity(row)));
}

async function listShellsFromStrapi(): Promise<{ shells: StudioShell[]; schemaSource: StrapiSchemaSource }> {
  try {
    const shells = await listShellsFromCollection(CANONICAL_SHELL_COLLECTION, mapShellFromCanonical);
    return {
      shells,
      schemaSource: "canonical"
    };
  } catch {
    const shells = await listShellsFromCollection(LEGACY_SHELL_COLLECTION, mapShellFromLegacy);
    return {
      shells,
      schemaSource: "legacy"
    };
  }
}

function resolveEntityMutationId(value: Record<string, unknown>): string | null {
  if (typeof value.documentId === "string" && value.documentId.length > 0) {
    return value.documentId;
  }
  if (typeof value.id === "string" || typeof value.id === "number") {
    return String(value.id);
  }
  return null;
}

async function upsertShellInCanonicalStrapi(shell: StudioShell): Promise<void> {
  const lookup = await requestStrapi<StrapiCollectionResponse>(
    `${CANONICAL_SHELL_COLLECTION}?filters[shellKey][$eq]=${encodeURIComponent(shell.key)}&pagination[pageSize]=1`
  );
  const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  const existingId = existing ? resolveEntityMutationId(existing) : null;

  const payload = {
    shellKey: shell.key,
    name: shell.name,
    role: shell.role,
    status: shell.status,
    menuItems: shell.menuItems,
    actions: shell.actions,
    navbarBlocks: shell.navbarBlocks,
    footerBlocks: shell.footerBlocks,
    previewHtml: shell.previewHtml
  };

  if (existingId !== null) {
    await requestStrapi(`${CANONICAL_SHELL_COLLECTION}/${encodeURIComponent(existingId)}`, {
      method: "PUT",
      body: payload
    });
    return;
  }

  await requestStrapi(CANONICAL_SHELL_COLLECTION, {
    method: "POST",
    body: payload
  });
}

async function upsertShellInLegacyStrapi(shell: StudioShell): Promise<void> {
  const lookup = await requestStrapi<StrapiCollectionResponse>(
    `${LEGACY_SHELL_COLLECTION}?filters[variantKey][$eq]=${encodeURIComponent(shell.key)}&pagination[pageSize]=1`
  );
  const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  const existingId = existing ? resolveEntityMutationId(existing) : null;

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

  if (existingId !== null) {
    await requestStrapi(`${LEGACY_SHELL_COLLECTION}/${encodeURIComponent(existingId)}`, {
      method: "PUT",
      body: payload
    });
    return;
  }

  await requestStrapi(LEGACY_SHELL_COLLECTION, {
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
      const { shells, schemaSource } = await listShellsFromStrapi();
      if (shells.length > 0) {
        return Response.json({
          ok: true,
          data: shells,
          source: "strapi",
          schemaSource
        });
      }
    } catch {
      // fall back
    }
  }

  return Response.json({
    ok: true,
    data: getStudioStore().shells,
    source: "fallback",
    schemaSource: "fallback"
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as { shell?: unknown };
    const shell = normalizeShell(payload.shell);

    if (isStrapiConfigured()) {
      try {
        await upsertShellInCanonicalStrapi(shell);
        const shells = await listShellsFromCollection(CANONICAL_SHELL_COLLECTION, mapShellFromCanonical);
        return Response.json({
          ok: true,
          data: shells,
          source: "strapi",
          schemaSource: "canonical"
        });
      } catch {
        try {
          await upsertShellInLegacyStrapi(shell);
          const shells = await listShellsFromCollection(LEGACY_SHELL_COLLECTION, mapShellFromLegacy);
          return Response.json({
            ok: true,
            data: shells,
            source: "strapi",
            schemaSource: "legacy",
            warning: "Shell persisted via legacy collection fallback. Run schema migration to canonical studio-shells."
          });
        } catch {
          const fallbackShells = upsertShellInFallback(shell);
          return Response.json({
            ok: true,
            data: fallbackShells,
            source: "fallback",
            schemaSource: "fallback"
          });
        }
      }
    }

    const fallbackShells = upsertShellInFallback(shell);
    return Response.json({
      ok: true,
      data: fallbackShells,
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
