import assert from "node:assert/strict";
import test from "node:test";

import {
  createSubmitArtistApplicationHandler,
  type SubmitArtistApplicationEnvironment,
} from "../supabase/functions/submit-artist-application/index.ts";

const environment: SubmitArtistApplicationEnvironment = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  TURNSTILE_SECRET_KEY: "turnstile-secret",
  COMMUNITY_POLICY_VERSION: "community-2026-07",
};

const validBody = {
  activityName: "종이산책",
  proofUrl: "https://example.com/artist?utm_source=test#works",
  primaryField: "문구",
  optionalPublicUrl: null,
  applicantNote: null,
  botToken: "single-use-token",
  idempotencyKey: "request-1",
  policyConsent: true,
  policyVersion: "community-2026-07",
};

function request(
  body: unknown = validBody,
  init: { authorization?: string | null; contentType?: string; method?: string } = {},
) {
  return new Request("https://functions.example.test/submit-artist-application", {
    method: init.method ?? "POST",
    headers: {
      ...(init.authorization === null
        ? {}
        : { Authorization: init.authorization ?? "Bearer user-token" }),
      "Content-Type": init.contentType ?? "application/json",
      "cf-connecting-ip": "203.0.113.5",
    },
    body: (init.method ?? "POST") === "POST" ? JSON.stringify(body) : undefined,
  });
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

test("requires bearer authentication before any upstream request", async () => {
  let calls = 0;
  const handler = createSubmitArtistApplicationHandler({
    environment,
    fetcher: async () => {
      calls += 1;
      throw new Error("unexpected fetch");
    },
  });

  const response = await handler(
    request(validBody, { authorization: null }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await json(response), {
    ok: false,
    code: "sign-in-required",
  });
  assert.equal(calls, 0);
});

test("rejects invalid input and stale policy consent before Turnstile", async () => {
  const urls: string[] = [];
  const handler = createSubmitArtistApplicationHandler({
    environment,
    fetcher: async (input) => {
      const url = String(input);
      urls.push(url);
      assert.match(url, /\/auth\/v1\/user$/);
      return Response.json({ id: "50000000-0000-4000-8000-000000000001" });
    },
  });

  const staleConsent = await handler(
    request({ ...validBody, policyVersion: "community-2026-06" }),
  );
  assert.equal(staleConsent.status, 400);
  assert.equal((await json(staleConsent)).code, "consent-required");

  const missingConsent = await handler(
    request({ ...validBody, policyConsent: false }),
  );
  assert.equal(missingConsent.status, 400);
  assert.equal((await json(missingConsent)).code, "consent-required");

  const invalidInput = await handler(
    request({ ...validBody, proofUrl: "http://127.0.0.1/private" }),
  );
  assert.equal(invalidInput.status, 400);
  assert.equal((await json(invalidInput)).code, "invalid-input");
  assert.equal(urls.length, 3);
});

test("returns an existing idempotent result before consuming Turnstile", async () => {
  const urls: string[] = [];
  const application = {
    id: "application-1",
    user_id: "50000000-0000-4000-8000-000000000001",
    idempotency_key: "request-1",
  };
  const handler = createSubmitArtistApplicationHandler({
    environment,
    fetcher: async (input, init) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith("/auth/v1/user")) {
        return Response.json({ id: application.user_id });
      }
      assert.match(
        url,
        /\/rest\/v1\/rpc\/get_artist_application_by_idempotency_service$/,
      );
      assert.equal(init?.headers && new Headers(init.headers).get("apikey"), "service-role-key");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        p_user_id: application.user_id,
        p_idempotency_key: "request-1",
      });
      return Response.json({ ok: true, code: "existing", application });
    },
  });

  const response = await handler(request());

  assert.equal(response.status, 200);
  assert.deepEqual(await json(response), {
    ok: true,
    code: "existing",
    application,
  });
  assert.equal(urls.length, 2);
  assert.equal(urls.some((url) => url.includes("turnstile")), false);
  assert.equal(urls.some((url) => url.endsWith("submit_artist_application_service")), false);
});

test("verifies Turnstile only for a new application and maps a created RPC result", async () => {
  const urls: string[] = [];
  const handler = createSubmitArtistApplicationHandler({
    environment,
    fetcher: async (input, init) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith("/auth/v1/user")) {
        return Response.json({ id: "50000000-0000-4000-8000-000000000001" });
      }
      if (url.endsWith("get_artist_application_by_idempotency_service")) {
        return Response.json(null);
      }
      if (url.includes("turnstile/v0/siteverify")) {
        assert.match(String(init?.body), /response=single-use-token/);
        assert.match(String(init?.body), /remoteip=203\.0\.113\.5/);
        return Response.json({ success: true });
      }
      assert.ok(url.endsWith("submit_artist_application_service"));
      assert.equal(new Headers(init?.headers).get("apikey"), "service-role-key");
      return Response.json({
        ok: true,
        code: "created",
        application: { id: "application-1" },
      });
    },
  });

  const response = await handler(request());

  assert.equal(response.status, 201);
  assert.equal((await json(response)).code, "created");
  assert.deepEqual(
    urls.map((url) => new URL(url).pathname),
    [
      "/auth/v1/user",
      "/rest/v1/rpc/get_artist_application_by_idempotency_service",
      "/turnstile/v0/siteverify",
      "/rest/v1/rpc/submit_artist_application_service",
    ],
  );
});

test("blocks submission when Turnstile fails", async () => {
  const urls: string[] = [];
  const handler = createSubmitArtistApplicationHandler({
    environment,
    fetcher: async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith("/auth/v1/user")) {
        return Response.json({ id: "50000000-0000-4000-8000-000000000001" });
      }
      if (url.endsWith("get_artist_application_by_idempotency_service")) {
        return Response.json(null);
      }
      return Response.json({ success: false });
    },
  });

  const response = await handler(request());

  assert.equal(response.status, 400);
  assert.equal((await json(response)).code, "bot-verification-failed");
  assert.equal(urls.length, 3);
});

test("maps service RPC outcomes to stable HTTP statuses", async () => {
  const cases = [
    ["existing", true, 200],
    ["rate-limited", false, 429],
    ["already-applied", false, 409],
    ["duplicate-proof", false, 409],
    ["forbidden", false, 403],
    ["invalid-input", false, 400],
  ] as const;

  for (const [code, ok, expectedStatus] of cases) {
    const handler = createSubmitArtistApplicationHandler({
      environment,
      fetcher: async (input) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) {
          return Response.json({ id: "50000000-0000-4000-8000-000000000001" });
        }
        if (url.endsWith("get_artist_application_by_idempotency_service")) {
          return Response.json(null);
        }
        if (url.includes("turnstile/v0/siteverify")) {
          return Response.json({ success: true });
        }
        return Response.json({ ok, code });
      },
    });

    const response = await handler(request());
    assert.equal(response.status, expectedStatus, code);
    assert.deepEqual(await json(response), { ok, code });
  }
});

test("fails closed when configuration or service requests are unavailable", async () => {
  const missingConfig = createSubmitArtistApplicationHandler({
    environment: { ...environment, SUPABASE_SERVICE_ROLE_KEY: undefined },
    fetcher: async () => {
      throw new Error("unexpected fetch");
    },
  });
  assert.equal((await missingConfig(request())).status, 503);

  const unavailable = createSubmitArtistApplicationHandler({
    environment,
    fetcher: async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/user")) {
        return Response.json({ id: "50000000-0000-4000-8000-000000000001" });
      }
      return new Response("unavailable", { status: 503 });
    },
  });
  const response = await unavailable(request());
  assert.equal(response.status, 503);
  assert.equal((await json(response)).code, "submission-unavailable");
});
