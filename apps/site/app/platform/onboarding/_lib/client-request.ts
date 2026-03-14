"use client";

export const DEFAULT_CLIENT_TIMEOUT_MS = 25_000;

type RequestJsonOptions = {
  timeoutMs?: number;
  timeoutMessage?: string;
  fallbackErrorMessage?: string;
};

function readPayloadError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const row = payload as Record<string, unknown>;
  if (typeof row.error === "string" && row.error.trim().length > 0) {
    return row.error.trim();
  }
  return null;
}

export async function requestClientJson<T>(
  url: string,
  init: RequestInit,
  options: RequestJsonOptions = {}
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    let payload: unknown = null;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(
        readPayloadError(payload) ??
          options.fallbackErrorMessage ??
          `Request failed (${response.status}).`
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(options.timeoutMessage ?? "Request timed out. Please retry.");
    }
    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    clearTimeout(timeout);
  }
}
