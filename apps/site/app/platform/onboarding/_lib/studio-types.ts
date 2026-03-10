export type StudioThemeTokenCategory = "color" | "typography" | "spacing" | "radius" | "shadow";

export type StudioThemeStatus = "active" | "inactive" | "draft";

export type StudioShellRole = "navbar" | "footer" | "full";

export type StudioShellStatus = "active" | "inactive";

export type StudioFidelityMode = "allow-below-threshold" | "disallow-below-threshold";

export type StudioActionType =
  | "link_url"
  | "scroll_to_section"
  | "open_modal"
  | "open_drawer"
  | "open_widget"
  | "submit_form"
  | "download_asset"
  | "external_booking"
  | "workflow";

const STUDIO_ACTION_TYPES = [
  "link_url",
  "scroll_to_section",
  "open_modal",
  "open_drawer",
  "open_widget",
  "submit_form",
  "download_asset",
  "external_booking",
  "workflow"
] as const;

const STUDIO_THEME_STATUSES = ["active", "inactive", "draft"] as const;

export function isStudioActionType(value: unknown): value is StudioActionType {
  return typeof value === "string" && STUDIO_ACTION_TYPES.includes(value as (typeof STUDIO_ACTION_TYPES)[number]);
}

export function isStudioThemeStatus(value: unknown): value is StudioThemeStatus {
  return typeof value === "string" && STUDIO_THEME_STATUSES.includes(value as (typeof STUDIO_THEME_STATUSES)[number]);
}

export interface StudioThemeToken {
  key: string;
  label: string;
  category: StudioThemeTokenCategory;
  value: string;
  cssVariable: string;
  mapped: boolean;
}

export interface StudioTheme {
  id: string;
  themeKey: string;
  name: string;
  status: StudioThemeStatus;
  sourceRef: string;
  createdAt: string;
  updatedAt: string;
  tokenCoverage: number;
  themeDebt: string;
  darkMode: boolean;
  tokens: StudioThemeToken[];
}

export interface StudioMenuItem {
  id: string;
  label: string;
  href: string;
  children?: StudioMenuItem[];
}

export interface StudioShellAction {
  id: string;
  label: string;
  type: Extract<StudioActionType, "link_url" | "scroll_to_section" | "open_modal" | "open_drawer">;
  target: string;
}

export interface StudioShell {
  id: string;
  key: string;
  name: string;
  role: StudioShellRole;
  status: StudioShellStatus;
  updatedAt: string;
  menuItems: StudioMenuItem[];
  actions: StudioShellAction[];
  navbarBlocks: string[];
  footerBlocks: string[];
  previewHtml: string;
}

export interface StudioBlockTemplateAction {
  id: string;
  label: string;
  type: StudioActionType;
  target: string;
}

export interface StudioBlockTemplate {
  id: string;
  key: string;
  name: string;
  family: string;
  status: "active" | "inactive" | "draft";
  themeKey: string;
  sourceType: string;
  sourceRef: string;
  confidence: number;
  editableFields: string[];
  actions: StudioBlockTemplateAction[];
  previewHtml: string;
  inUseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudioPageDocument {
  id: string;
  name: string;
  slug: string;
  locale: string;
  activeShellId?: string;
  blockOrder: string[];
  fieldValues: Record<string, string>;
  actionOverrides: Record<
    string,
    {
      id: string;
      blockId: string;
      label: string;
      type: string;
      target: string;
    }
  >;
  previewHtml: string;
  updatedAt: string;
}

export interface StudioApiResponse<T> {
  ok: boolean;
  data: T;
  source: "strapi" | "fallback";
}

export interface StudioFidelitySettings {
  mode: StudioFidelityMode;
  threshold: number;
}

export interface StudioSettings {
  fidelity: StudioFidelitySettings;
}
