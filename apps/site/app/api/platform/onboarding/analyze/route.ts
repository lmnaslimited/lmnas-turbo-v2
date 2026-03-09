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
