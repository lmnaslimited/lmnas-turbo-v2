import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

function normalizePreviewTarget(rawTarget: string | null): string {
  if (!rawTarget) {
    return "/";
  }

  const parsed = new URL(rawTarget, "http://localhost");
  const nestedSlug = parsed.searchParams.get("slug");
  if (nestedSlug) {
    return normalizePreviewTarget(nestedSlug);
  }

  const path = decodeURIComponent(parsed.pathname).replace(/^\/+/, "/");
  const normalizedPath = !path || path === "/preview" ? "/" : path;
  return normalizedPath === "/home" ? "/" : normalizedPath;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const expectedSecret = process.env.STRAPI_PREVIEW_TOKEN;
  const providedSecret = url.searchParams.get("secret") ?? url.searchParams.get("token");

  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return new NextResponse("Invalid preview token.", { status: 401 });
  }

  const rawTarget =
    url.searchParams.get("url") ??
    url.searchParams.get("path") ??
    url.searchParams.get("pathname") ??
    url.searchParams.get("slug");

  const redirectTarget = normalizePreviewTarget(rawTarget);
  const preview = await draftMode();
  preview.enable();

  return NextResponse.redirect(new URL(redirectTarget, url.origin));
}
