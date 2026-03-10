import { resetStore } from "../_lib/store";

export async function POST(): Promise<Response> {
  const snapshot = resetStore();
  return Response.json({
    ok: true,
    data: {
      themes: snapshot.themes.length,
      shells: snapshot.shells.length,
      blocks: snapshot.blocks.length,
      pages: snapshot.pages.length
    },
    source: "fallback"
  });
}
