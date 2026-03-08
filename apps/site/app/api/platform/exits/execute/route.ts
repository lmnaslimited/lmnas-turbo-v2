import { parseExitDefinition } from "@lmnas/contracts";
import { ExitAdapterRuntime } from "@lmnas/integrations";

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as {
      definition?: unknown;
      context?: {
        environment?: string;
        payload?: Record<string, unknown>;
      };
    };

    const definition = parseExitDefinition(payload.definition);
    const runtime = new ExitAdapterRuntime();
    const result = await runtime.execute(definition, {
      environment: payload.context?.environment ?? "dev",
      payload: payload.context?.payload
    });

    return Response.json({
      ok: true,
      result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        ok: false,
        error: message
      },
      {
        status: 400
      }
    );
  }
}
