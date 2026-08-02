import type { SupabaseClient } from "@supabase/supabase-js";

import { getCommunityAccess, type CommunityActor } from "../../community-access.ts";
import {
  COMMUNITY_CATEGORY_CATALOG,
  type CommunityCategoryId,
} from "../../community.ts";
import {
  durableCommunityPostToView,
  type DurableCommunityPostState,
} from "./posts.ts";

export type CommunitySearchBoard = "all" | "general" | "artists";
export type CommunitySearchResolution = "all" | "resolved" | "unresolved";
export type CommunitySearchFreshness = "all" | "fresh" | "stale" | "missing";
export type CommunitySearchFreshnessValue = Exclude<
  CommunitySearchFreshness,
  "all"
>;

export type CommunitySearchInput = {
  query?: string;
  board?: CommunitySearchBoard;
  categoryId?: string | null;
  resolution?: CommunitySearchResolution;
  freshness?: CommunitySearchFreshness;
  limit?: number;
  cursor?: string | null;
};

export type CommunitySearchCursor = {
  rank: number;
  updatedAt: string;
  id: string;
};

export type CommunitySearchPost = {
  id: string;
  boardId: "general" | "artists";
  authorId: string;
  authorName: string | null;
  categoryId: CommunityCategoryId;
  kind: "experience" | "fact" | "question";
  state: DurableCommunityPostState;
  title: string;
  body: string;
  isResolved: boolean;
  source: {
    label: string;
    url: string;
    checkedAt: string;
    validForDays: number;
  } | null;
  freshness: CommunitySearchFreshnessValue;
  rank: number;
  publishedAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CommunitySearchRepositoryInput = {
  query: string;
  boardIds: Array<"general" | "artists">;
  categoryId: CommunityCategoryId | null;
  isResolved: boolean | null;
  freshness: CommunitySearchFreshness;
  now: string;
  limit: number;
  cursor?: CommunitySearchCursor;
};

export type CommunitySearchRepository = {
  search(input: CommunitySearchRepositoryInput): Promise<CommunitySearchPost[]>;
};

export function communitySearchPostToView(post: CommunitySearchPost) {
  return durableCommunityPostToView({
    ...post,
    source: post.source
      ? {
          label: post.source.label,
          url: post.source.url,
          checkedAt: post.source.checkedAt,
        }
      : null,
  });
}

const CATEGORY_IDS = new Set<string>(
  COMMUNITY_CATEGORY_CATALOG.map((category) => category.id),
);
const BOARDS = new Set<CommunitySearchBoard>(["all", "general", "artists"]);
const RESOLUTIONS = new Set<CommunitySearchResolution>([
  "all",
  "resolved",
  "unresolved",
]);
const FRESHNESS_VALUES = new Set<CommunitySearchFreshness>([
  "all",
  "fresh",
  "stale",
  "missing",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function encodeBase64Url(value: string) {
  return btoa(value)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
}

export function encodeCommunitySearchCursor(post: CommunitySearchPost) {
  return encodeBase64Url(JSON.stringify([post.rank, post.updatedAt, post.id]));
}

export function decodeCommunitySearchCursor(
  value: string | null | undefined,
): CommunitySearchCursor | null {
  if (!value || value.length > 512) return null;
  try {
    const decoded = JSON.parse(decodeBase64Url(value)) as unknown;
    if (!Array.isArray(decoded) || decoded.length !== 3) return null;
    const [rank, updatedAt, id] = decoded;
    if (
      typeof rank !== "number" ||
      !Number.isFinite(rank) ||
      typeof updatedAt !== "string" ||
      Number.isNaN(Date.parse(updatedAt)) ||
      typeof id !== "string" ||
      !UUID_PATTERN.test(id)
    ) {
      return null;
    }
    return { rank, updatedAt, id };
  } catch {
    return null;
  }
}

export function communitySearchPageHref(
  path: string,
  filters: Record<string, string | null | undefined>,
  cursor: string,
) {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== "all") parameters.set(key, value);
  }
  parameters.set("cursor", cursor);
  return `${path}?${parameters.toString()}`;
}

function normalizeQuery(value: string | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
}

function normalizeBoard(value: CommunitySearchBoard | undefined) {
  return value && BOARDS.has(value) ? value : "all";
}

function normalizeResolution(value: CommunitySearchResolution | undefined) {
  return value && RESOLUTIONS.has(value) ? value : "all";
}

function normalizeFreshness(value: CommunitySearchFreshness | undefined) {
  return value && FRESHNESS_VALUES.has(value) ? value : "all";
}

function getAuthorizedBoards(
  actor: CommunityActor,
  requestedBoard: CommunitySearchBoard,
) {
  const capabilities = getCommunityAccess(actor).capabilities;
  const readable = [] as Array<"general" | "artists">;
  if (capabilities.includes("general:read")) readable.push("general");
  if (capabilities.includes("artist:read")) readable.push("artists");
  return requestedBoard === "all"
    ? readable
    : readable.filter((board) => board === requestedBoard);
}

export async function searchCommunityPosts(
  command: {
    actor: CommunityActor;
    input: CommunitySearchInput;
    now: Date;
  },
  dependencies: { repository: CommunitySearchRepository },
) {
  const board = normalizeBoard(command.input.board);
  const resolution = normalizeResolution(command.input.resolution);
  const freshness = normalizeFreshness(command.input.freshness);
  const categoryId =
    command.input.categoryId && CATEGORY_IDS.has(command.input.categoryId)
      ? (command.input.categoryId as CommunityCategoryId)
      : null;
  const boardIds = getAuthorizedBoards(command.actor, board);
  const cursor = decodeCommunitySearchCursor(command.input.cursor);
  const pageSize = Math.min(
    Math.max(Math.trunc(command.input.limit ?? 24), 1),
    100,
  );
  const filters = {
    query: normalizeQuery(command.input.query),
    board,
    categoryId,
    resolution,
    freshness,
  };

  // Authorization is resolved before the database search is allowed to rank
  // anything. In particular, a revoked artist-only request never reaches the
  // repository with a protected board identifier.
  if (boardIds.length === 0) return { posts: [], filters, nextCursor: null };

  const repositoryInput: CommunitySearchRepositoryInput = {
    query: filters.query,
    boardIds,
    categoryId,
    isResolved:
      resolution === "all" ? null : resolution === "resolved",
    freshness,
    now: command.now.toISOString(),
    limit: pageSize,
  };
  if (cursor) repositoryInput.cursor = cursor;
  const posts = await dependencies.repository.search(repositoryInput);
  const authorizedBoards = new Set(boardIds);

  const authorizedPosts = posts
    // RLS and the RPC enforce these constraints independently. Keep this
    // final boundary defensive so a repository regression cannot leak rows.
    .filter(
      (post) =>
        authorizedBoards.has(post.boardId) &&
        post.state === "published" &&
        post.deletedAt === null,
    )
    .sort(
      (left, right) =>
        right.rank - left.rank ||
        right.updatedAt.localeCompare(left.updatedAt) ||
        left.id.localeCompare(right.id),
    );
  const pagePosts = authorizedPosts.slice(0, pageSize);
  const hasNextPage = authorizedPosts.length > pageSize;

  return {
    filters,
    posts: pagePosts,
    nextCursor:
      hasNextPage && pagePosts.length > 0
        ? encodeCommunitySearchCursor(pagePosts[pagePosts.length - 1]!)
        : null,
  };
}

function postFromRow(row: Record<string, unknown>): CommunitySearchPost {
  const sourceLabel =
    typeof row.source_label === "string" ? row.source_label : null;
  const sourceUrl = typeof row.source_url === "string" ? row.source_url : null;
  const sourceCheckedAt =
    typeof row.source_checked_at === "string" ? row.source_checked_at : null;
  const sourceValidForDays = Number(row.source_valid_for_days);

  return {
    id: String(row.id),
    boardId: row.board_id as CommunitySearchPost["boardId"],
    authorId: String(row.author_id),
    authorName:
      typeof row.author_name === "string" ? row.author_name : null,
    categoryId: row.category_id as CommunityCategoryId,
    kind: row.kind as CommunitySearchPost["kind"],
    state: row.state as DurableCommunityPostState,
    title: String(row.title),
    body: String(row.body),
    isResolved: row.is_resolved === true,
    source:
      sourceLabel && sourceUrl && sourceCheckedAt
        ? {
            label: sourceLabel,
            url: sourceUrl,
            checkedAt: sourceCheckedAt,
            validForDays: Number.isFinite(sourceValidForDays)
              ? sourceValidForDays
              : 90,
          }
        : null,
    freshness: row.freshness as CommunitySearchFreshnessValue,
    rank: Number(row.search_rank) || 0,
    publishedAt: String(row.published_at),
    updatedAt: String(row.updated_at),
    deletedAt: typeof row.deleted_at === "string" ? row.deleted_at : null,
  };
}

export function createSupabaseCommunitySearchRepository(
  client: SupabaseClient,
): CommunitySearchRepository {
  return {
    async search(input) {
      const { data, error } = await client.rpc("search_community_posts", {
        p_query: input.query,
        p_board_ids: input.boardIds,
        p_category_id: input.categoryId,
        p_is_resolved: input.isResolved,
        p_freshness: input.freshness,
        p_now: input.now,
        p_limit: input.limit + 1,
        p_cursor_rank: input.cursor?.rank ?? null,
        p_cursor_updated_at: input.cursor?.updatedAt ?? null,
        p_cursor_id: input.cursor?.id ?? null,
      });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => postFromRow(row));
    },
  };
}
