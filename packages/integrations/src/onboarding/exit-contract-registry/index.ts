import {
  parseExitDefinition,
  type ExitBinding,
  type ExitDefinition,
  type OnboardingExitProposal,
  type OnboardingOverride
} from "@lmnas/contracts";

export class ExitContractRegistry {
  private readonly definitions = new Map<string, ExitDefinition>();

  register(definitionInput: unknown): ExitDefinition {
    const definition = parseExitDefinition(definitionInput);
    this.definitions.set(definition.id, definition);
    return definition;
  }

  registerMany(definitions: unknown[]): ExitDefinition[] {
    return definitions.map((definition) => this.register(definition));
  }

  list(): ExitDefinition[] {
    return Array.from(this.definitions.values());
  }

  resolve(exitId: string): ExitDefinition | undefined {
    return this.definitions.get(exitId);
  }

  setState(exitId: string, state: ExitDefinition["state"]): ExitDefinition {
    const current = this.resolve(exitId);
    if (!current) {
      throw new Error(`Unknown exit definition: ${exitId}`);
    }

    const next: ExitDefinition = {
      ...current,
      state
    };
    this.definitions.set(exitId, next);
    return next;
  }
}

function toExitDefinition(proposal: OnboardingExitProposal, overrides?: OnboardingOverride): ExitDefinition {
  const stateOverride = overrides?.exitStateOverrides[proposal.id];

  return {
    id: proposal.id,
    name: proposal.name,
    state: stateOverride ?? proposal.state,
    eventName: proposal.eventName,
    payloadSchema: {
      format: "json-schema",
      schema: {
        type: "object",
        additionalProperties: true
      }
    },
    frontendAdapterType: proposal.frontendAdapterType,
    backendAdapterType: proposal.backendAdapterType,
    workflowTarget: proposal.workflowTarget,
    fallbackBehavior: "show_fallback_contact",
    successBehavior: "show_success_message",
    failureBehavior: "show_error_message",
    analyticsMapping: {
      click: proposal.eventName
    },
    policy: {
      environmentAllowlist: [],
      roleAllowlist: []
    }
  };
}

function toExitBinding(proposal: OnboardingExitProposal): ExitBinding {
  return {
    id: `binding-${proposal.id}`,
    exitId: proposal.id,
    locationType: proposal.suggestedBinding.locationType,
    locationId: proposal.suggestedBinding.locationId,
    label: proposal.name
  };
}

export function createExitContractsFromProposals(params: {
  proposals: OnboardingExitProposal[];
  overrides?: OnboardingOverride;
}): { definitions: ExitDefinition[]; bindings: ExitBinding[] } {
  const definitions = params.proposals.map((proposal) => toExitDefinition(proposal, params.overrides));
  const bindings = params.proposals.map((proposal) => toExitBinding(proposal));

  return {
    definitions,
    bindings
  };
}
