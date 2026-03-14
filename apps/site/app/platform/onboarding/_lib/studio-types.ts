export type StudioThemeTokenCategory = "color" | "typography" | "spacing" | "radius" | "shadow";

export type StudioThemeStatus = "active" | "inactive" | "draft";

export type StudioShellRole = "navbar" | "footer" | "full";

export type StudioShellStatus = "active" | "inactive";

export type StudioFidelityMode = "allow-below-threshold" | "disallow-below-threshold";

export type StudioEntityLifecycle = "draft" | "published" | "archived";

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

export type StudioWidgetType =
  | "modal"
  | "drawer"
  | "embedded_form"
  | "subscription_popup"
  | "booking_popup"
  | "download_gate"
  | "chat_launcher"
  | "inline_expand_collapse"
  | "below_fold_widget";

export type StudioWidgetSurface = "modal" | "drawer" | "inline" | "popup" | "below_fold";

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
  lifecycle?: StudioEntityLifecycle;
  scope?: "global" | "page-local";
  schemaStatus?: "valid" | "invalid" | "warning";
  themeKey: string;
  sourceType: string;
  sourceRef: string;
  confidence: number;
  editableFields: string[];
  actions: StudioBlockTemplateAction[];
  previewHtml: string;
  sourcePreviewHtml?: string;
  targetPreviewHtml?: string;
  sourceAssetContext?: {
    baseUrl?: string;
    importKey?: string;
    importMasterId?: string;
    assetManifest?: Record<string, string>;
  };
  importMasterId?: string;
  importMasterKey?: string;
  importProposalId?: string;
  inUseCount: number;
  usageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudioPrimaryCta {
  text: string;
  url: string;
}

export interface StudioPageConversionConfig {
  trackConversions: boolean;
  strategy: string;
  valuePoints: number;
}

export interface StudioCampaignUtmStrategy {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}

export interface StudioSeoMetadata {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl?: string;
}

export interface StudioTaxonomyState {
  valid: boolean;
  tags: string[];
  notes?: string;
}

export interface StudioPageDocument {
  id: string;
  name: string;
  slug: string;
  locale: string;
  publishedAt?: string;
  publishedPreviewHtml?: string;
  importMasterId?: string;
  activeShellId?: string;
  shellId?: string;
  shellKey?: string;
  themeId?: string;
  themeKey?: string;
  lifecycle?: StudioEntityLifecycle;
  status?: "draft" | "published";
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
  productMapping: string;
  industryMapping: string[];
  primaryCta: StudioPrimaryCta;
  conversionConfig: StudioPageConversionConfig;
  campaignUtmStrategy: StudioCampaignUtmStrategy;
  taxonomyState: StudioTaxonomyState;
  seoMetadata: StudioSeoMetadata;
  seoJsonLdValid: boolean;
  blockSchemaValid: boolean;
  previewValid: boolean;
  previewHtml: string;
  updatedAt: string;
}

export interface StudioImportMaster {
  id: string;
  importKey: string;
  sourceType: string;
  sourceRef: string;
  sourceTitle?: string;
  sourceSummary?: string;
  sourceHtml?: string;
  sourceRawMarkupPreview?: string;
  sourceBaseUrl?: string;
  sourceAssetBases?: string[];
  sourceAssetManifest?: Record<string, string>;
  sourceStyleProfile?: Record<string, unknown>;
  sourceThemeCharacteristics?: Record<string, unknown>;
  sourceShellCharacteristics?: Array<Record<string, unknown>>;
  referencePreviewHtml: string;
  targetPreviewHtml: string;
  selectedThemeKey: string;
  selectedShellKey: string;
  importMode: "blocks" | "page";
  status: "processed" | "imported_blocks" | "imported_page" | "failed";
  lifecycle: "draft" | "active" | "archived";
  extractionSummary?: Record<string, unknown>;
  proposalSummary?: Record<string, unknown>;
  warnings?: string[];
  uploadSummary?: {
    fileName: string;
    htmlEntry: string;
    htmlEntryCount: number;
  };
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudioWidgetPlacement {
  mode: "embed" | "reference";
  pageId?: string;
  blockId?: string;
}

export interface StudioWidgetRecord {
  id: string;
  key: string;
  name: string;
  widgetType: StudioWidgetType;
  surface: StudioWidgetSurface;
  status: "active" | "inactive";
  lifecycle?: StudioEntityLifecycle;
  readiness?: "ready" | "warning" | "blocked";
  repoPath: string;
  description?: string;
  editableFields: string[];
  defaultExitId?: string;
  visualMockHtml?: string;
  placement: StudioWidgetPlacement;
  updatedAt: string;
  lastExecutedAt?: string;
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
