import {
  createSupabaseModerationRepository,
  moderateCommunityReport,
  type ModerationAction,
} from "../../../../../lib/server/community/moderation.ts";
import { getCurrentCommunityMember } from "../../../../../lib/server/community/session.ts";
import { isSameOriginMutation, jsonNoStore, jsonServiceError, readJsonObject } from "../../../../../lib/server/request-security.ts";
import { getSupabasePublicConfig } from "../../../../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

const ACTIONS = new Set<ModerationAction>([
  "triage", "dismiss", "hide", "lock", "restore", "suspend_account", "resolve_appeal",
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return jsonNoStore({ ok: false, code: "invalid-origin" }, { status: 403 });
  const config = getSupabasePublicConfig();
  if (config.status !== "configured") return jsonNoStore({ ok: false, code: "not-configured" }, { status: 503 });
  const session = await getCurrentCommunityMember({ config });
  if (!session.member || !session.access.capabilities.includes("moderation:reports")) {
    return jsonNoStore({ ok: false, code: "forbidden" }, { status: 403 });
  }
  const body = await readJsonObject(request);
  const action = String(body?.action ?? "") as ModerationAction;
  if (!body || !ACTIONS.has(action)) return jsonNoStore({ ok: false, code: "invalid-input" }, { status: 400 });

  try {
    const { id } = await context.params;
    const client = await createSupabaseServerClient(config);
    const result = await moderateCommunityReport({
      actor: session.member.actor,
      actorId: session.member.id,
      reportId: id,
      action,
      reason: String(body.reason ?? ""),
      now: new Date(),
    }, { repository: createSupabaseModerationRepository(client!) });
    return jsonNoStore(result, { status: result.ok ? 200 : result.code === "not-found" ? 404 : result.code.includes("forbidden") || result.code === "admin-required" ? 403 : 400 });
  } catch {
    return jsonServiceError();
  }
}
