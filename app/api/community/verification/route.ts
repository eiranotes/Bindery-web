import { getCurrentCommunityMember } from "../../../lib/server/community/session.ts";
import {
  createSupabaseVerificationDependencies,
  submitArtistApplication,
} from "../../../lib/server/community/verification.ts";
import {
  isSameOriginMutation,
  jsonNoStore,
  jsonServiceError,
  readJsonObject,
} from "../../../lib/server/request-security.ts";
import { getSupabasePublicConfig } from "../../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

function resultStatus(code: string) {
  if (code === "forbidden") return 401;
  if (code === "duplicate-proof" || code === "already-applied") return 409;
  if (code === "rate-limited") return 429;
  if (code === "bot-verification-failed" || code === "invalid-input") return 400;
  return 500;
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return jsonNoStore({ ok: false, code: "invalid-origin" }, { status: 403 });
  }

  const config = getSupabasePublicConfig();
  if (config.status !== "configured") {
    return jsonNoStore(
      { ok: false, code: "not-configured" },
      { status: 503 },
    );
  }

  const session = await getCurrentCommunityMember({ config });
  if (!session.member) {
    return jsonNoStore({ ok: false, code: "sign-in-required" }, { status: 401 });
  }

  const body = await readJsonObject(request);
  if (!body) {
    return jsonNoStore({ ok: false, code: "invalid-json" }, { status: 400 });
  }

  try {
    const client = await createSupabaseServerClient(config);
    const dependencies = createSupabaseVerificationDependencies(client!, {
      remoteIp:
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
    const result = await submitArtistApplication(
      {
        actor: session.member.actor,
        userId: session.member.id,
        input: {
          activityName: String(body.activityName ?? ""),
          proofUrl: String(body.proofUrl ?? ""),
          primaryField: String(body.primaryField ?? ""),
          optionalPublicUrl:
            typeof body.optionalPublicUrl === "string"
              ? body.optionalPublicUrl
              : null,
          applicantNote:
            typeof body.applicantNote === "string" ? body.applicantNote : null,
          policyVersion: "community-2026-07",
        },
        botToken: String(body.botToken ?? ""),
        idempotencyKey:
          request.headers.get("idempotency-key") ??
          String(body.idempotencyKey ?? ""),
        now: new Date(),
      },
      dependencies,
    );

    return jsonNoStore(result, {
      status: result.ok
        ? result.code === "created"
          ? 201
          : 200
        : resultStatus(result.code),
    });
  } catch {
    return jsonServiceError();
  }
}
