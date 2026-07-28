import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "../../lib/supabase/config.ts";
import { safeCommunityReturnPath } from "../../lib/supabase/redirect.ts";
import { createSupabaseServerClient } from "../../lib/supabase/server.ts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnPath = safeCommunityReturnPath(url.searchParams.get("next"));
  const config = getSupabasePublicConfig();

  if (config.status !== "configured") {
    const response = NextResponse.redirect(
      new URL("/auth/sign-in?error=not-configured", url.origin),
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  if (!code) {
    const response = NextResponse.redirect(
      new URL("/auth/sign-in?error=missing-code", url.origin),
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const client = await createSupabaseServerClient(config);
  const { error } = await client!.auth.exchangeCodeForSession(code);
  const destination = error
    ? "/auth/sign-in?error=callback"
    : returnPath;
  const response = NextResponse.redirect(new URL(destination, url.origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
