import { publishOnboardingDraft } from "@lmnas/integrations";
import { loadProjectEnv } from "../../../../lib/env";

export async function POST(request: Request): Promise<Response> {
  try {
    loadProjectEnv();
    const payload = (await request.json()) as unknown;
    const result = await publishOnboardingDraft(payload);

    return Response.json({
      ok: true,
      result
    });
  } catch (error) {
    console.error("Publish error:", error);
    const message = error instanceof Error ? error.message : String(error);
    const isEnvMissing = message.includes("STRAPI") || message.includes("env") || message.includes("undefined");
    return Response.json(
      {
        ok: false,
        error: isEnvMissing
          ? `Missing environment configuration: ${message}`
          : message
      },
      {
        status: 400
      }
    );
  }
}
