import { publishOnboardingDraft } from "@lmnas/integrations";

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as unknown;
    const result = await publishOnboardingDraft(payload);

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
