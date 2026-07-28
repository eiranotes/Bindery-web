import { getCommunityCategory } from "../../../lib/community.ts";
import {
  createCommunityPost,
  createSupabaseCommunityRepository,
} from "../../../lib/server/community/posts.ts";
import { getCurrentCommunityMember } from "../../../lib/server/community/session.ts";
import {
  isSameOriginMutation,
  jsonNoStore,
  jsonServiceError,
  readJsonObject,
} from "../../../lib/server/request-security.ts";
import { getSupabasePublicConfig } from "../../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = getSupabasePublicConfig();
  if (config.status !== "configured") {
    return jsonNoStore({ ok: false, code: "not-configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const category = getCommunityCategory(url.searchParams.get("category"));
  try {
    const client = await createSupabaseServerClient(config);
    const posts = await createSupabaseCommunityRepository(client!).listPosts({
      boardId: "general",
      categoryId: category?.id,
    });
    return jsonNoStore({ ok: true, posts });
  } catch {
    return jsonServiceError();
  }
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return jsonNoStore({ ok: false, code: "invalid-origin" }, { status: 403 });
  }

  const config = getSupabasePublicConfig();
  if (config.status !== "configured") {
    return jsonNoStore({ ok: false, code: "not-configured" }, { status: 503 });
  }
  const session = await getCurrentCommunityMember({ config });
  if (!session.member) {
    return jsonNoStore({ ok: false, code: "sign-in-required" }, { status: 401 });
  }

  const body = await readJsonObject(request);
  if (!body) {
    return jsonNoStore({ ok: false, code: "invalid-json" }, { status: 400 });
  }

  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  try {
    const client = await createSupabaseServerClient(config);
    const result = await createCommunityPost(
      {
        actor: session.member.actor,
        userId: session.member.id,
        input: {
          boardId: body.boardId === "artists" ? "artists" : "general",
          categoryId: String(body.categoryId ?? "") as never,
          kind: String(body.kind ?? "question") as never,
          title: String(body.title ?? ""),
          body: String(body.body ?? ""),
          source: sourceUrl
            ? {
                label: String(body.sourceLabel ?? "참고 원문"),
                url: sourceUrl,
                checkedAt: String(body.sourceCheckedAt ?? ""),
              }
            : null,
        },
        now: new Date(),
      },
      { repository: createSupabaseCommunityRepository(client!) },
    );
    return jsonNoStore(result, {
      status: result.ok ? 201 : result.code === "rate-limited" ? 429 : 400,
    });
  } catch {
    return jsonServiceError();
  }
}
