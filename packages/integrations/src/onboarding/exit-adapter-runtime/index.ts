import type { ExitDefinition } from "@lmnas/contracts";

export type ExitAdapterResult = {
  status: "success" | "failure" | "skipped";
  message: string;
  target?: string;
};

export type ExitExecutionContext = {
  environment: string;
  payload?: Record<string, unknown>;
};

type AdapterHandler = (definition: ExitDefinition, context: ExitExecutionContext) => Promise<ExitAdapterResult>;

export class ExitAdapterRuntime {
  private readonly frontendAdapters = new Map<ExitDefinition["frontendAdapterType"], AdapterHandler>();
  private readonly backendAdapters = new Map<ExitDefinition["backendAdapterType"], AdapterHandler>();

  constructor() {
    this.registerDefaults();
  }

  registerFrontendAdapter(type: ExitDefinition["frontendAdapterType"], handler: AdapterHandler): void {
    this.frontendAdapters.set(type, handler);
  }

  registerBackendAdapter(type: ExitDefinition["backendAdapterType"], handler: AdapterHandler): void {
    this.backendAdapters.set(type, handler);
  }

  async execute(definition: ExitDefinition, context: ExitExecutionContext): Promise<ExitAdapterResult> {
    if (definition.state !== "active") {
      return {
        status: "skipped",
        message: `Exit ${definition.id} is inactive`
      };
    }

    const frontendHandler = this.frontendAdapters.get(definition.frontendAdapterType);
    const backendHandler = this.backendAdapters.get(definition.backendAdapterType);

    if (!frontendHandler && !backendHandler) {
      return {
        status: "failure",
        message: `No adapter registered for exit ${definition.id}`
      };
    }

    if (frontendHandler) {
      const frontendResult = await frontendHandler(definition, context);
      if (frontendResult.status !== "success") {
        return frontendResult;
      }
    }

    if (backendHandler) {
      return backendHandler(definition, context);
    }

    return {
      status: "success",
      message: `Exit ${definition.id} executed through frontend adapter`,
      target: definition.workflowTarget.value
    };
  }

  private registerDefaults(): void {
    this.registerFrontendAdapter("redirect", async (definition) => ({
      status: "success",
      message: "Redirect adapter resolved",
      target: definition.workflowTarget.value
    }));

    this.registerFrontendAdapter("modal", async (definition) => ({
      status: "success",
      message: "Modal adapter resolved",
      target: definition.workflowTarget.value
    }));

    this.registerFrontendAdapter("form", async (definition) => ({
      status: "success",
      message: "Form adapter resolved",
      target: definition.workflowTarget.value
    }));

    this.registerFrontendAdapter("chat_drawer", async () => ({
      status: "success",
      message: "Chat drawer opened"
    }));

    this.registerFrontendAdapter("none", async () => ({
      status: "success",
      message: "No frontend adapter required"
    }));

    this.registerBackendAdapter("none", async () => ({
      status: "success",
      message: "No backend adapter required"
    }));

    this.registerBackendAdapter("api", async (definition) => ({
      status: "success",
      message: "API adapter resolved",
      target: definition.workflowTarget.value
    }));

    this.registerBackendAdapter("n8n_webhook", async (definition) => ({
      status: "success",
      message: "n8n webhook adapter resolved",
      target: definition.workflowTarget.value
    }));
  }
}
