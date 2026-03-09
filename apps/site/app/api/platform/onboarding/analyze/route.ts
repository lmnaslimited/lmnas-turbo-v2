import { analyzeOnboardingSource } from "@lmnas/integrations";
import { loadProjectEnv } from "../../../../lib/env";

export async function POST(request: Request): Promise<Response> {
  try {
    loadProjectEnv();
    const payload = (await request.json()) as unknown;
    const analysis = await analyzeOnboardingSource(payload);

    return Response.json({
      ok: true,
      analysis
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isEnvMissing = message.includes("STRAPI") || message.includes("env") || message.includes("undefined");
    return Response.json(
      {
        ok: false,
        error: isEnvMissing
          ? "Missing environment configuration. Ensure STRAPI_URL and STRAPI_API_TOKEN are set in .env at the monorepo root."
          : message
      },
      {
        status: 400
      }
    );
  }
}
