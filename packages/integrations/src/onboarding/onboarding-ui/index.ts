import { parseOnboardingAnalysis, parseOnboardingPublishRequest, type OnboardingAnalysis, type OnboardingPublishResult } from "@lmnas/contracts";
import { detectBlockProposals } from "../block-detector";
import { mapBlocksToSchema } from "../block-schema-mapper";
import { createExitContractsFromProposals } from "../exit-contract-registry";
import { detectExitProposals } from "../exit-detector";
import { detectEditableFields } from "../field-detector";
import { buildFidelityWarnings } from "../fidelity-reporter";
import { assemblePage } from "../page-assembler";
import { renderAssemblyPreviewModel } from "../renderer";
import { mapShellCandidatesToSchema } from "../shell-schema-mapper";
import { detectShellCandidates } from "../shell-detector";
import { ingestSource } from "../source-ingestion";
import { buildStrapiSyncPayload, publishStrapiSyncPayload } from "../strapi-sync";
import { analyzeTheme } from "../theme-engine";

export async function analyzeOnboardingSource(input: unknown): Promise<OnboardingAnalysis> {
  const ingested = await ingestSource(input);
  const shellCandidates = detectShellCandidates(ingested.html);
  const blockProposals = detectEditableFields(detectBlockProposals(ingested.html));
  const exitProposals = detectExitProposals(ingested.html, blockProposals);
  const theme = analyzeTheme(ingested.html, ingested.intake.themeKey);

  const fidelityWarnings = buildFidelityWarnings({
    shellCandidates,
    blockProposals,
    theme
  });

  const preview = renderAssemblyPreviewModel(ingested.html, blockProposals);
  fidelityWarnings.push({
    code: "preview.structural_match",
    message: `Source sections=${preview.sourceSectionCount}, mapped blocks=${preview.mappedBlockCount}, structural match=${(
      preview.structuralMatchRatio * 100
    ).toFixed(1)}%`,
    severity: preview.structuralMatchRatio < 0.7 ? "warning" : "info"
  });

  return parseOnboardingAnalysis({
    intake: ingested.intake,
    shellCandidates,
    blockProposals,
    exitProposals,
    theme,
    fidelityWarnings
  });
}

export async function publishOnboardingDraft(input: unknown): Promise<OnboardingPublishResult> {
  const request = parseOnboardingPublishRequest(input);
  const shell = mapShellCandidatesToSchema({
    slug: request.analysis.intake.slug,
    shellCandidates: request.analysis.shellCandidates,
    overrides: request.overrides
  });

  const blocks = mapBlocksToSchema(request.analysis.blockProposals, request.overrides);
  const exits = createExitContractsFromProposals({
    proposals: request.analysis.exitProposals,
    overrides: request.overrides
  });

  const pageAssembly = assemblePage({
    slug: request.analysis.intake.slug,
    locale: request.analysis.intake.locale,
    shellAssignment: shell.shellAssignment,
    blocks
  });

  const payload = buildStrapiSyncPayload({
    shell,
    blocks,
    exits,
    pageAssembly
  });

  return publishStrapiSyncPayload({
    mode: request.mode,
    payload,
    warnings: request.analysis.fidelityWarnings
  });
}
