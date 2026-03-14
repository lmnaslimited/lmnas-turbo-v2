/* eslint-disable no-restricted-imports */
import { z } from "zod";

export const canonicalBlockFamilySchema = z.enum([
  "hero",
  "logo_wall",
  "problem_grid",
  "feature_grid",
  "testimonial_list",
  "stats_band",
  "process_steps",
  "cta_banner",
  "faq",
  "rich_text_section",
  "comparison_table",
  "pricing_teaser",
  "contact_strip",
  "authority_section",
  "case_highlight",
  "timeline",
  "split_content_media",
  "form_section",
  "embedded_asset_section"
]);

export const widgetTypeSchema = z.enum([
  "modal",
  "drawer",
  "embedded_form",
  "subscription_popup",
  "booking_popup",
  "download_gate",
  "chat_launcher",
  "inline_expand_collapse",
  "below_fold_widget"
]);

export const actionTypeSchema = z.enum([
  "link_url",
  "scroll_to_section",
  "open_modal",
  "open_drawer",
  "open_widget",
  "submit_form",
  "download_asset",
  "external_booking",
  "workflow"
]);

export const onboardingItemTypeSchema = z.enum(["shell", "block", "widget", "action", "exit"]);
export const segmentationModeSchema = z.enum(["keep", "split", "merge"]);

export const navigationDestinationTypeSchema = z.enum(["internal", "external", "asset", "exit"]);

export const navigationDestinationSchema = z
  .object({
    type: navigationDestinationTypeSchema,
    value: z.string().min(1),
    exitId: z.string().min(1).optional()
  })
  .superRefine((value, ctx) => {
    if (value.type !== "exit" || value.exitId) {
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["exitId"],
      message: "exitId is required when destination type is exit"
    });
  });

export const navigationItemSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    label: z.string().min(1),
    destination: navigationDestinationSchema.optional(),
    children: z.array(navigationItemSchema).max(12).default([])
  })
);

export const navigationGroupSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  items: z.array(navigationItemSchema).max(20)
});

export const navigationMenuSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  items: z.array(navigationItemSchema).max(50),
  groups: z.array(navigationGroupSchema).max(10).default([])
});

export const navbarVariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  menuId: z.string().min(1),
  sticky: z.boolean().default(false),
  mobileBehavior: z.enum(["drawer", "overlay", "inline"]).default("drawer"),
  ctaSlotLabel: z.string().min(1).optional(),
  announcementBarText: z.string().min(1).optional(),
  utilityBarEnabled: z.boolean().default(false)
});

export const footerColumnSchema = z.object({
  id: z.string().min(1),
  heading: z.string().min(1),
  links: z.array(navigationItemSchema).max(20)
});

export const footerLegalStripSchema = z.object({
  copyrightText: z.string().min(1),
  legalLinks: z.array(navigationItemSchema).max(12).default([])
});

export const footerVariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  columns: z.array(footerColumnSchema).max(8).default([]),
  legalStrip: footerLegalStripSchema.optional()
});

export const shellVariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  navbarVariantId: z.string().min(1),
  footerVariantId: z.string().min(1),
  description: z.string().min(1).optional()
});

export const shellAssignmentScopeSchema = z.enum(["site", "page"]);

export const shellAssignmentSchema = z.object({
  scope: shellAssignmentScopeSchema,
  shellVariantId: z.string().min(1),
  pageSlug: z.string().min(1).optional(),
  navbarVariantId: z.string().min(1).optional(),
  footerVariantId: z.string().min(1).optional()
});

export const exitStateSchema = z.enum(["active", "inactive"]);

export const exitExecutionTargetSchema = z.object({
  kind: z.enum(["none", "url", "n8n_webhook", "api", "modal", "chat_drawer"]),
  value: z.string().min(1)
});

export const exitPayloadSchemaSchema = z.object({
  format: z.enum(["json-schema", "openapi-ref", "typed-config"]).default("json-schema"),
  schema: z.record(z.unknown()).default({})
});

export const exitPolicySchema = z.object({
  environmentAllowlist: z.array(z.string().min(1)).default([]),
  roleAllowlist: z.array(z.string().min(1)).default([])
});

export const exitDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  state: exitStateSchema,
  eventName: z.string().min(1),
  payloadSchema: exitPayloadSchemaSchema,
  frontendAdapterType: z.enum(["redirect", "modal", "form", "chat_drawer", "none"]),
  backendAdapterType: z.enum(["n8n_webhook", "api", "none"]),
  workflowTarget: exitExecutionTargetSchema,
  fallbackBehavior: z.string().min(1),
  successBehavior: z.string().min(1),
  failureBehavior: z.string().min(1),
  analyticsMapping: z.record(z.string(), z.string()).default({}),
  policy: exitPolicySchema.default({ environmentAllowlist: [], roleAllowlist: [] })
});

export const exitBindingSchema = z.object({
  id: z.string().min(1),
  exitId: z.string().min(1),
  locationType: z.enum(["block", "navbar", "footer", "widget", "page"]),
  locationId: z.string().min(1),
  label: z.string().min(1)
});

export const exitAuditLogSchema = z.object({
  exitId: z.string().min(1),
  status: z.enum(["success", "failure", "skipped"]),
  timestamp: z.string().min(1),
  reason: z.string().min(1).optional()
});

export const widgetDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  widgetType: widgetTypeSchema,
  state: exitStateSchema.default("active"),
  description: z.string().min(1).optional(),
  editableFields: z.array(z.string().min(1)).default([]),
  defaultExitId: z.string().min(1).optional()
});

export const widgetVariantSchema = z.object({
  id: z.string().min(1),
  widgetId: z.string().min(1),
  name: z.string().min(1),
  surface: z.enum(["modal", "drawer", "inline", "popup", "below_fold"]).default("inline"),
  config: z.record(z.unknown()).default({})
});

export const actionBindingSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    actionType: actionTypeSchema,
    locationType: z.enum(["block", "navbar", "footer", "widget", "page"]),
    locationId: z.string().min(1),
    targetUrl: z.string().min(1).optional(),
    targetSectionId: z.string().min(1).optional(),
    widgetId: z.string().min(1).optional(),
    exitId: z.string().min(1).optional(),
    openInNewTab: z.boolean().default(false)
  })
  .superRefine((value, ctx) => {
    if (["link_url", "download_asset", "external_booking"].includes(value.actionType) && !value.targetUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetUrl"],
        message: `targetUrl is required for ${value.actionType}`
      });
    }

    if (value.actionType === "scroll_to_section" && !value.targetSectionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetSectionId"],
        message: "targetSectionId is required for scroll_to_section"
      });
    }

    if (["open_modal", "open_drawer", "open_widget"].includes(value.actionType) && !value.widgetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["widgetId"],
        message: `widgetId is required for ${value.actionType}`
      });
    }

    if (["workflow", "submit_form"].includes(value.actionType) && !value.exitId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exitId"],
        message: `exitId is required for ${value.actionType}`
      });
    }
  });

export const onboardingSourceTypeSchema = z.enum([
  "stitch_section",
  "stitch_full_page",
  "figma_section",
  "figma_full_page",
  "url",
  "raw_html"
]);

export const onboardingIntakeSchema = z.object({
  sourceType: onboardingSourceTypeSchema,
  sourceValue: z.string().min(1),
  slug: z.string().min(1),
  locale: z.string().min(1).default("en"),
  themeKey: z.string().min(1).default("default")
});

export const onboardingSourceStyleProfileSchema = z.object({
  appliedStrategy: z.enum(["source_document", "scoped_reconstruction", "unstyled_fallback"]).default("source_document"),
  inlineStyleTagCount: z.number().int().min(0).default(0),
  linkedStylesheetCount: z.number().int().min(0).default(0),
  unresolvedStylesheetCount: z.number().int().min(0).default(0),
  fidelityNotes: z.array(z.string().min(1)).default([])
});

export const onboardingSourcePreviewSchema = z.object({
  sourceRef: z.string().min(1),
  title: z.string().min(1).optional(),
  referencePreviewHtml: z.string().min(1),
  productionPreviewHtml: z.string().min(1),
  rawMarkupPreview: z.string().min(1).optional(),
  baseUrl: z.string().min(1).optional(),
  themeScopeClass: z.string().min(1).default("theme-default"),
  styleProfile: onboardingSourceStyleProfileSchema.default({
    appliedStrategy: "source_document",
    inlineStyleTagCount: 0,
    linkedStylesheetCount: 0,
    unresolvedStylesheetCount: 0,
    fidelityNotes: []
  })
});

export const onboardingShellCandidateSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).optional(),
  type: z.enum(["navbar", "footer", "utility_bar", "announcement_bar"]),
  selectorHint: z.string().min(1),
  previewSelector: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1),
  menuItems: z.array(navigationItemSchema).default([]),
  editableFields: z.array(z.string().min(1)).default([]),
  ctaLabels: z.array(z.string().min(1)).default([]),
  sourceSnippet: z.string().min(1).optional(),
  previewHtml: z.string().min(1).optional()
});

export const onboardingBlockProposalSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).optional(),
  family: canonicalBlockFamilySchema,
  selectorHint: z.string().min(1),
  previewSelector: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1),
  editableFields: z.array(z.string().min(1)).default([]),
  ctaLabels: z.array(z.string().min(1)).default([]),
  actionIds: z.array(z.string().min(1)).default([]),
  segmentation: segmentationModeSchema.default("keep"),
  rawHtmlSnippet: z.string().min(1).optional(),
  sourceSnippet: z.string().min(1).optional(),
  previewHtml: z.string().min(1).optional()
});

export const onboardingWidgetProposalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1).optional(),
  widgetType: widgetTypeSchema,
  selectorHint: z.string().min(1),
  previewSelector: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1),
  editableFields: z.array(z.string().min(1)).default([]),
  triggerLabels: z.array(z.string().min(1)).default([]),
  associatedActionIds: z.array(z.string().min(1)).default([]),
  sourceSnippet: z.string().min(1).optional(),
  previewHtml: z.string().min(1).optional()
});

export const actionDestinationSchema = z.object({
  kind: z.enum(["url", "section", "widget", "exit", "none"]),
  value: z.string().min(1).optional()
});

export const onboardingActionProposalSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  displayName: z.string().min(1).optional(),
  selectorHint: z.string().min(1),
  previewSelector: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1),
  actionType: actionTypeSchema,
  sourceSurface: z.enum(["shell", "block", "widget", "unknown"]).default("unknown"),
  sourceItemId: z.string().min(1).optional(),
  sourceItemLabel: z.string().min(1).optional(),
  ctaKind: z.enum(["anchor", "button", "unknown"]).default("unknown"),
  ctaHref: z.string().min(1).optional(),
  ctaButtonType: z.string().min(1).optional(),
  destination: actionDestinationSchema,
  suggestedExitId: z.string().min(1).optional(),
  summary: z.string().min(1),
  sourceSnippet: z.string().min(1).optional(),
  previewHtml: z.string().min(1).optional()
});

export const onboardingExitProposalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  eventName: z.string().min(1),
  selectorHint: z.string().min(1),
  confidence: z.number().min(0).max(1),
  state: exitStateSchema,
  frontendAdapterType: z.enum(["redirect", "modal", "form", "chat_drawer", "none"]),
  backendAdapterType: z.enum(["n8n_webhook", "api", "none"]),
  workflowTarget: exitExecutionTargetSchema,
  sourceActionId: z.string().min(1).optional(),
  suggestedBinding: z.object({
    locationType: z.enum(["block", "navbar", "footer", "widget", "page"]),
    locationId: z.string().min(1)
  })
});

export const onboardingThemeNotesSchema = z.object({
  themeKey: z.string().min(1),
  tokenFirstMatchRatio: z.number().min(0).max(1),
  arbitraryValueCount: z.number().int().min(0),
  themeDebtSummary: z.string().min(1),
  hasDarkModeTrigger: z.boolean().default(false),
  extractedFonts: z.array(z.string().min(1)).default([]),
  extractedColors: z.record(z.string(), z.string()).default({}),
  utilityClassUsages: z.array(z.string().min(1)).default([])
});

export const fidelityWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(["info", "warning", "error"])
});

export const onboardingAnalysisSchema = z.object({
  intake: onboardingIntakeSchema,
  source: onboardingSourcePreviewSchema,
  shellCandidates: z.array(onboardingShellCandidateSchema),
  blockProposals: z.array(onboardingBlockProposalSchema),
  widgetProposals: z.array(onboardingWidgetProposalSchema),
  actionProposals: z.array(onboardingActionProposalSchema),
  exitProposals: z.array(onboardingExitProposalSchema),
  theme: onboardingThemeNotesSchema,
  fidelityWarnings: z.array(fidelityWarningSchema)
});

const actionTargetOverrideSchema = z.object({
  url: z.string().min(1).optional(),
  sectionId: z.string().min(1).optional(),
  widgetId: z.string().min(1).optional(),
  exitId: z.string().min(1).optional()
});

export const onboardingOverrideSchema = z.object({
  shellVariantId: z.string().min(1).optional(),
  navbarVariantId: z.string().min(1).optional(),
  footerVariantId: z.string().min(1).optional(),
  displayNameOverrides: z.record(z.string(), z.string().min(1)).default({}),
  blockFamilyOverrides: z.record(z.string(), canonicalBlockFamilySchema).default({}),
  exitStateOverrides: z.record(z.string(), exitStateSchema).default({}),
  itemImportState: z.record(z.string(), z.boolean()).default({}),
  itemTypeOverrides: z.record(z.string(), onboardingItemTypeSchema).default({}),
  fieldOverrides: z.record(z.string(), z.array(z.string().min(1))).default({}),
  mapToExisting: z.record(z.string(), z.string().min(1)).default({}),
  segmentationOverrides: z.record(z.string(), segmentationModeSchema).default({}),
  actionTypeOverrides: z.record(z.string(), actionTypeSchema).default({}),
  actionLabelOverrides: z.record(z.string(), z.string().min(1)).default({}),
  actionTargetOverrides: z.record(z.string(), actionTargetOverrideSchema).default({})
});

export const pageAssemblySchema = z.object({
  slug: z.string().min(1),
  locale: z.string().min(1),
  shellAssignment: shellAssignmentSchema,
  blockOrder: z.array(z.string().min(1)).min(1),
  widgetOrder: z.array(z.string().min(1)).default([]),
  actionBindingIds: z.array(z.string().min(1)).default([]),
  footerVariantId: z.string().min(1),
  navbarVariantId: z.string().min(1)
});

export const strapiSyncPayloadSchema = z.object({
  shellVariants: z.array(shellVariantSchema),
  navbarVariants: z.array(navbarVariantSchema),
  footerVariants: z.array(footerVariantSchema),
  menus: z.array(navigationMenuSchema),
  blockInstances: z.array(onboardingBlockProposalSchema),
  widgetDefinitions: z.array(widgetDefinitionSchema),
  widgetVariants: z.array(widgetVariantSchema),
  actionBindings: z.array(actionBindingSchema),
  exitDefinitions: z.array(exitDefinitionSchema),
  exitBindings: z.array(exitBindingSchema),
  pageAssembly: pageAssemblySchema
});

export const onboardingPublishRequestSchema = z.object({
  analysis: onboardingAnalysisSchema,
  overrides: onboardingOverrideSchema.default({
    displayNameOverrides: {},
    blockFamilyOverrides: {},
    exitStateOverrides: {},
    itemImportState: {},
    itemTypeOverrides: {},
    fieldOverrides: {},
    mapToExisting: {},
    segmentationOverrides: {},
    actionTypeOverrides: {},
    actionLabelOverrides: {},
    actionTargetOverrides: {}
  }),
  mode: z.enum(["dry-run", "apply"]).default("dry-run")
});

export const onboardingPublishResultSchema = z.object({
  mode: z.enum(["dry-run", "apply"]),
  applied: z.boolean(),
  applyReadiness: z.object({
    canApply: z.boolean(),
    missingEnvKeys: z.array(z.string().min(1)).default([]),
    operatorMessage: z.string().min(1),
    developerMessage: z.string().min(1).optional()
  }),
  summary: z.object({
    shellsToCreate: z.number().int().min(0),
    blocksToCreate: z.number().int().min(0),
    widgetsToCreate: z.number().int().min(0),
    actionsToCreate: z.number().int().min(0),
    exitsRequired: z.number().int().min(0),
    editableFieldsCreated: z.number().int().min(0),
    warningsCount: z.number().int().min(0)
  }),
  previewLinks: z.array(z.string().min(1)).default([]),
  warnings: z.array(fidelityWarningSchema),
  assemblyPreviewHtml: z.string().min(1).optional(),
  strapiPayload: strapiSyncPayloadSchema
});

export type CanonicalBlockFamily = z.infer<typeof canonicalBlockFamilySchema>;
export type WidgetType = z.infer<typeof widgetTypeSchema>;
export type ActionType = z.infer<typeof actionTypeSchema>;
export type OnboardingItemType = z.infer<typeof onboardingItemTypeSchema>;
export type SegmentationMode = z.infer<typeof segmentationModeSchema>;
export type NavigationDestination = z.infer<typeof navigationDestinationSchema>;
export type NavigationItem = z.infer<typeof navigationItemSchema>;
export type NavigationGroup = z.infer<typeof navigationGroupSchema>;
export type NavigationMenu = z.infer<typeof navigationMenuSchema>;
export type NavbarVariant = z.infer<typeof navbarVariantSchema>;
export type FooterColumn = z.infer<typeof footerColumnSchema>;
export type FooterLegalStrip = z.infer<typeof footerLegalStripSchema>;
export type FooterVariant = z.infer<typeof footerVariantSchema>;
export type ShellVariant = z.infer<typeof shellVariantSchema>;
export type ShellAssignment = z.infer<typeof shellAssignmentSchema>;
export type ExitExecutionTarget = z.infer<typeof exitExecutionTargetSchema>;
export type ExitDefinition = z.infer<typeof exitDefinitionSchema>;
export type ExitBinding = z.infer<typeof exitBindingSchema>;
export type ExitPolicy = z.infer<typeof exitPolicySchema>;
export type ExitState = z.infer<typeof exitStateSchema>;
export type ExitAuditLog = z.infer<typeof exitAuditLogSchema>;
export type WidgetDefinition = z.infer<typeof widgetDefinitionSchema>;
export type WidgetVariant = z.infer<typeof widgetVariantSchema>;
export type ActionBinding = z.infer<typeof actionBindingSchema>;
export type OnboardingSourceType = z.infer<typeof onboardingSourceTypeSchema>;
export type OnboardingIntake = z.infer<typeof onboardingIntakeSchema>;
export type OnboardingSourceStyleProfile = z.infer<typeof onboardingSourceStyleProfileSchema>;
export type OnboardingSourcePreview = z.infer<typeof onboardingSourcePreviewSchema>;
export type OnboardingShellCandidate = z.infer<typeof onboardingShellCandidateSchema>;
export type OnboardingBlockProposal = z.infer<typeof onboardingBlockProposalSchema>;
export type OnboardingWidgetProposal = z.infer<typeof onboardingWidgetProposalSchema>;
export type OnboardingActionProposal = z.infer<typeof onboardingActionProposalSchema>;
export type OnboardingExitProposal = z.infer<typeof onboardingExitProposalSchema>;
export type OnboardingThemeNotes = z.infer<typeof onboardingThemeNotesSchema>;
export type FidelityWarning = z.infer<typeof fidelityWarningSchema>;
export type OnboardingAnalysis = z.infer<typeof onboardingAnalysisSchema>;
export type OnboardingOverride = z.infer<typeof onboardingOverrideSchema>;
export type PageAssembly = z.infer<typeof pageAssemblySchema>;
export type StrapiSyncPayload = z.infer<typeof strapiSyncPayloadSchema>;
export type OnboardingPublishRequest = z.infer<typeof onboardingPublishRequestSchema>;
export type OnboardingPublishResult = z.infer<typeof onboardingPublishResultSchema>;

export function parseOnboardingIntake(value: unknown): OnboardingIntake {
  return onboardingIntakeSchema.parse(value);
}

export function parseOnboardingAnalysis(value: unknown): OnboardingAnalysis {
  return onboardingAnalysisSchema.parse(value);
}

export function parseOnboardingPublishRequest(value: unknown): OnboardingPublishRequest {
  return onboardingPublishRequestSchema.parse(value);
}

export function parseOnboardingPublishResult(value: unknown): OnboardingPublishResult {
  return onboardingPublishResultSchema.parse(value);
}

export function parseExitDefinition(value: unknown): ExitDefinition {
  return exitDefinitionSchema.parse(value);
}

export function parseExitBinding(value: unknown): ExitBinding {
  return exitBindingSchema.parse(value);
}

export function parseWidgetDefinition(value: unknown): WidgetDefinition {
  return widgetDefinitionSchema.parse(value);
}

export function parseWidgetVariant(value: unknown): WidgetVariant {
  return widgetVariantSchema.parse(value);
}

export function parseActionBinding(value: unknown): ActionBinding {
  return actionBindingSchema.parse(value);
}

export function parseShellAssignment(value: unknown): ShellAssignment {
  return shellAssignmentSchema.parse(value);
}
