import { NextResponse } from "next/server";

export function isSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}

export function jsonNoStore(
  body: unknown,
  { status = 200 }: { status?: number } = {},
) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export function jsonServiceError() {
  return jsonNoStore(
    {
      ok: false,
      code: "service-error",
      message: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    },
    { status: 500 },
  );
}

export async function readJsonObject(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
