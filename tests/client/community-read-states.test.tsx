import type { AnchorHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const readState = vi.hoisted(() => ({
  mode: "success" as "success" | "empty" | "error",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("../../app/lib/supabase/config.ts", () => ({
  getSupabasePublicConfig: () => ({
    status: "configured" as const,
    url: "https://project.supabase.co",
    publishableKey: "public-test-key",
  }),
}));

vi.mock("../../app/lib/supabase/server.ts", () => ({
  createSupabaseServerClient: async () => ({}),
}));

vi.mock("../../app/lib/server/community/session.ts", () => ({
  getCurrentCommunityMember: async () => ({
    state: "signed_out",
    member: null,
    access: { capabilities: ["general:read"] },
  }),
}));

vi.mock("../../app/lib/server/community/knowledge.ts", () => ({
  createSupabaseKnowledgeRepository: () => ({ getPost: async () => null }),
  getCommunitySourceFreshness: () => "missing",
}));

vi.mock("../../app/lib/server/community/posts.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../app/lib/server/community/posts.ts")>();
  const durablePost = {
    id: "f1000000-0000-4000-8000-000000000001",
    boardId: "general" as const,
    authorId: "f0000000-0000-4000-8000-000000000001",
    authorName: "실제 회원",
    categoryId: "production" as const,
    kind: "question" as const,
    state: "published" as const,
    title: "연결된 공개 게시글",
    body: "운영 저장소에서 읽은 공개 게시글 본문입니다.",
    isResolved: false,
    source: null,
    publishedAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T01:00:00.000Z",
    deletedAt: null,
  };

  return {
    ...actual,
    createSupabaseCommunityRepository: () => ({
      listPosts: async () => {
        if (readState.mode === "error") throw new Error("read unavailable");
        return readState.mode === "empty" ? [] : [durablePost];
      },
      getPost: async () => {
        if (readState.mode === "error") throw new Error("read unavailable");
        return readState.mode === "empty" ? null : durablePost;
      },
      listComments: async () => [],
      listRevisions: async () => [],
      isBookmarked: async () => false,
    }),
  };
});

import CommunityPage from "../../app/community/page";
import CommunityPostPage from "../../app/community/general/[slug]/page";
import CommunityReportPage from "../../app/community/report/page";

beforeEach(() => {
  readState.mode = "success";
});

test("configured hub renders authorized public rows without prototype claims", async () => {
  render(await CommunityPage());

  expect(screen.getByText("연결된 공개 게시글")).toBeTruthy();
  expect(screen.queryByText("공개된 글은 실제 회원 게시물이 아닙니다.")).toBeNull();
  expect(screen.queryByText("화면 구조와 예시 글을 검증하는 단계입니다.")).toBeNull();
});

test("configured hub distinguishes an honest empty state from a retryable read error", async () => {
  readState.mode = "empty";
  const emptyView = render(await CommunityPage());
  expect(screen.getByText("아직 공개된 모두의 게시판 글이 없습니다.")).toBeTruthy();
  emptyView.unmount();

  readState.mode = "error";
  render(await CommunityPage());
  expect(screen.getByText("최근 공개 글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "다시 시도" }).getAttribute("href")).toBe("/community");
});

test("configured detail read errors render a retry action instead of not found", async () => {
  readState.mode = "error";
  render(
    await CommunityPostPage({
      params: Promise.resolve({ slug: "f1000000-0000-4000-8000-000000000001" }),
    }),
  );

  expect(screen.getByText("게시글을 불러오지 못했습니다.")).toBeTruthy();
  expect(screen.getByText("서비스 오류")).toBeTruthy();
  expect(screen.getByRole("link", { name: "다시 시도" }).getAttribute("href")).toBe(
    "/community/general/f1000000-0000-4000-8000-000000000001",
  );
});

test("configured report read errors do not masquerade as a missing target", async () => {
  readState.mode = "error";
  render(
    await CommunityReportPage({
      searchParams: Promise.resolve({
        post: "f1000000-0000-4000-8000-000000000001",
      }),
    }),
  );

  expect(screen.getByText("신고 대상 글을 불러오지 못했습니다.")).toBeTruthy();
  expect(screen.queryByText("신고할 공개 글을 찾을 수 없습니다.")).toBeNull();
  expect(screen.getByRole("link", { name: "다시 시도" }).getAttribute("href")).toBe(
    "/community/report?post=f1000000-0000-4000-8000-000000000001",
  );
});
