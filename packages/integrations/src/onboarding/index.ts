export { ingestSource } from "./source-ingestion";
export type { IngestedSource } from "./source-ingestion";

export { detectShellCandidates } from "./shell-detector";
export { detectBlockProposals } from "./block-detector";
export { detectEditableFields } from "./field-detector";
export { detectExitProposals } from "./exit-detector";

export { mapShellCandidatesToSchema } from "./shell-schema-mapper";
export type { ShellSchemaMapResult } from "./shell-schema-mapper";
export { mapBlocksToSchema } from "./block-schema-mapper";

export { ExitContractRegistry, createExitContractsFromProposals } from "./exit-contract-registry";
export { buildStrapiSyncPayload, publishStrapiSyncPayload } from "./strapi-sync";

export { assemblePage } from "./page-assembler";
export { renderAssemblyPreviewModel } from "./renderer";
export type { AssemblyPreviewModel } from "./renderer";

export { analyzeTheme } from "./theme-engine";
export { buildFidelityWarnings } from "./fidelity-reporter";

export { ExitAdapterRuntime } from "./exit-adapter-runtime";
export type { ExitAdapterResult, ExitExecutionContext } from "./exit-adapter-runtime";

export { analyzeOnboardingSource, publishOnboardingDraft } from "./onboarding-ui";
