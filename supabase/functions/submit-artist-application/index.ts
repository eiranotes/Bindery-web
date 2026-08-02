declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
};

type JsonObject = Record<string, unknown>;

export type SubmitArtistApplicationEnvironment = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  COMMUNITY_POLICY_VERSION?: string;
};

export type SubmitArtistApplicationHandlerDependencies = {
  environment: SubmitArtistApplicationEnvironment;
  fetcher: typeof fetch;
};

const DEFAULT_POLICY_VERSION = "community-2026-07";
const TRACKING_PARAMETERS = ["fbclid", "gclid", "igshid", "mc_cid", "mc_eid"];

function json(body: JsonObject, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function cleanText(value: unknown, maximum: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length > 0 && cleaned.length <= maximum ? cleaned : null;
}

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false;
  }

  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function isNonPublicHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    isPrivateIpv4(normalized)
  );
}

function normalizePublicUrl(value: unknown, optional = false) {
  if (optional && (typeof value !== "string" || value.trim() === "")) {
    return null;
  }
  if (typeof value !== "string") return undefined;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (url.username || url.password || isNonPublicHostname(url.hostname)) {
      return undefined;
    }

    url.hash = "";
    for (const parameter of [...url.searchParams.keys()]) {
      const normalized = parameter.toLowerCase();
      if (
        normalized.startsWith("utm_") ||
        TRACKING_PARAMETERS.includes(normalized)
      ) {
        url.searchParams.delete(parameter);
      }
    }
    url.searchParams.sort();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return null;
  }
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as JsonObject)
      : null;
  } catch {
    return null;
  }
}

async function authenticatedUserId(
  supabaseUrl: string,
  publicKey: string,
  authorization: string,
  fetcher: typeof fetch,
) {
  const response = await fetcher(new URL("/auth/v1/user", `${supabaseUrl}/`), {
    headers: { apikey: publicKey, Authorization: authorization },
  });
  if (!response.ok) return null;

  const user = (await response.json()) as { id?: unknown };
  return typeof user.id === "string" && user.id.length > 0 ? user.id : null;
}

async function verifyTurnstile(
  token: string,
  secretKey: string,
  remoteIp: string | null,
  fetcher: typeof fetch,
) {
  const body = new URLSearchParams({ secret: secretKey, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  const response = await fetcher(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!response.ok) return false;
  const result = (await response.json()) as { success?: unknown };
  return result.success === true;
}

function resultStatus(result: JsonObject) {
  if (result.ok === true) return result.code === "created" ? 201 : 200;
  if (result.code === "rate-limited") return 429;
  if (result.code === "already-applied" || result.code === "duplicate-proof") {
    return 409;
  }
  if (result.code === "forbidden") return 403;
  return 400;
}

function isResult(value: unknown): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { ok?: unknown }).ok === "boolean" &&
    typeof (value as { code?: unknown }).code === "string"
  );
}

async function existingApplicationResult(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  idempotencyKey: string,
  fetcher: typeof fetch,
) {
  const response = await fetcher(
    new URL(
      "/rest/v1/rpc/get_artist_application_by_idempotency_service",
      `${supabaseUrl}/`,
    ),
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
      }),
    },
  );
  if (!response.ok) return { available: false as const, result: null };

  const result = (await response.json().catch(() => undefined)) as unknown;
  if (result === null) return { available: true as const, result: null };
  if (isResult(result) && result.ok === true && result.code === "existing") {
    return { available: true as const, result };
  }
  return { available: false as const, result: null };
}

export function createSubmitArtistApplicationHandler({
  environment,
  fetcher,
}: SubmitArtistApplicationHandlerDependencies) {
  return async (request: Request) => {
  if (request.method !== "POST") {
    return json({ ok: false, code: "method-not-allowed" }, 405);
  }

  const supabaseUrl = environment.SUPABASE_URL?.trim();
  const publicKey = environment.SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const turnstileSecret = environment.TURNSTILE_SECRET_KEY?.trim();
  if (!supabaseUrl || !publicKey || !serviceRoleKey || !turnstileSecret) {
    return json({ ok: false, code: "not-configured" }, 503);
  }

  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.match(/^Bearer\s+\S+$/i)) {
    return json({ ok: false, code: "sign-in-required" }, 401);
  }

  let userId: string | null;
  try {
    userId = await authenticatedUserId(
      supabaseUrl,
      publicKey,
      authorization,
      fetcher,
    );
  } catch {
    return json({ ok: false, code: "submission-unavailable" }, 503);
  }
  if (!userId) return json({ ok: false, code: "sign-in-required" }, 401);

  const body = await readBody(request);
  if (!body) return json({ ok: false, code: "invalid-json" }, 400);
  if (body.policyConsent !== true) {
    return json(
      {
        ok: false,
        code: "consent-required",
        message: "커뮤니티 운영 규칙과 개인정보 처리 경계에 동의해 주세요.",
      },
      400,
    );
  }

  const policyVersion =
    environment.COMMUNITY_POLICY_VERSION?.trim() ?? DEFAULT_POLICY_VERSION;
  if (body.policyVersion !== policyVersion) {
    return json({ ok: false, code: "consent-required" }, 400);
  }

  const activityName = cleanText(body.activityName, 80);
  const primaryField = cleanText(body.primaryField, 80);
  const idempotencyKey = cleanText(body.idempotencyKey, 120);
  const proofUrlNormalized = normalizePublicUrl(body.proofUrl);
  const optionalPublicUrl = normalizePublicUrl(body.optionalPublicUrl, true);
  const applicantNote =
    typeof body.applicantNote === "string" && body.applicantNote.trim()
      ? body.applicantNote.trim()
      : null;
  const botToken = typeof body.botToken === "string" ? body.botToken.trim() : "";
  if (
    !activityName ||
    !primaryField ||
    !idempotencyKey ||
    !proofUrlNormalized ||
    optionalPublicUrl === undefined ||
    (applicantNote !== null && applicantNote.length > 500) ||
    !botToken
  ) {
    return json({ ok: false, code: "invalid-input" }, 400);
  }

  let existing: Awaited<ReturnType<typeof existingApplicationResult>>;
  try {
    existing = await existingApplicationResult(
      supabaseUrl,
      serviceRoleKey,
      userId,
      idempotencyKey,
      fetcher,
    );
  } catch {
    return json({ ok: false, code: "submission-unavailable" }, 503);
  }
  if (!existing.available) {
    return json({ ok: false, code: "submission-unavailable" }, 503);
  }
  if (existing.result) return json(existing.result, 200);

  const remoteIp =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  let turnstileVerified = false;
  try {
    turnstileVerified = await verifyTurnstile(
      botToken,
      turnstileSecret,
      remoteIp,
      fetcher,
    );
  } catch {
    turnstileVerified = false;
  }
  if (!turnstileVerified) {
    return json(
      {
        ok: false,
        code: "bot-verification-failed",
        message: "자동 제출 방지 확인에 실패했습니다.",
      },
      400,
    );
  }

  let rpcResponse: Response;
  try {
    rpcResponse = await fetcher(
      new URL(
        "/rest/v1/rpc/submit_artist_application_service",
        `${supabaseUrl}/`,
      ),
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_user_id: userId,
          p_activity_name: activityName,
          p_proof_url: String(body.proofUrl).trim(),
          p_proof_url_normalized: proofUrlNormalized,
          p_primary_field: primaryField,
          p_optional_public_url: optionalPublicUrl,
          p_applicant_note: applicantNote,
          p_idempotency_key: idempotencyKey,
          p_policy_version: policyVersion,
          p_policy_consent: true,
        }),
      },
    );
  } catch {
    return json({ ok: false, code: "submission-unavailable" }, 503);
  }

  if (!rpcResponse.ok) {
    const errorBody = (await rpcResponse.json().catch(() => null)) as
      | { code?: unknown }
      | null;
    if (errorBody?.code === "23505") {
      return json({ ok: false, code: "duplicate-proof" }, 409);
    }
    return json({ ok: false, code: "submission-unavailable" }, 503);
  }

  const result = (await rpcResponse.json().catch(() => null)) as unknown;
  if (!isResult(result)) {
    return json({ ok: false, code: "submission-unavailable" }, 503);
  }
  return json(result, resultStatus(result));
  };
}

if (typeof Deno !== "undefined") {
  Deno.serve(
    createSubmitArtistApplicationHandler({
      environment: {
        SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
        SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"),
        SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
        TURNSTILE_SECRET_KEY: Deno.env.get("TURNSTILE_SECRET_KEY"),
        COMMUNITY_POLICY_VERSION: Deno.env.get("COMMUNITY_POLICY_VERSION"),
      },
      fetcher: fetch,
    }),
  );
}
