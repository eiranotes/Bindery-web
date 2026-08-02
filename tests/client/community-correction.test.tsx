import type { AnchorHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { CommunityPostActions } from "../../app/components/CommunityPostActions";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

afterEach(() => {
  vi.restoreAllMocks();
  refresh.mockReset();
});

test("an author discovers the correction form and receives durable-history feedback", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ ok: true, code: "corrected" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  render(
    <CommunityPostActions
      postId="10000000-0000-4000-8000-000000000001"
      postTitle="수정 전 제목"
      postBody="수정 전 본문은 충분한 길이로 준비되어 있습니다."
      source={null}
      boardId="general"
      signedIn
      canCorrect
      isOperator={false}
      canDelete
      initiallyBookmarked={false}
    />,
  );

  fireEvent.click(screen.getByText("글 수정·정정"));
  fireEvent.change(screen.getByLabelText("제목"), { target: { value: "수정한 제목" } });
  fireEvent.change(screen.getByLabelText("본문"), {
    target: { value: "수정한 본문을 충분한 길이로 입력하고 저장합니다." },
  });
  fireEvent.change(screen.getByLabelText(/^수정 사유/), {
    target: { value: "표현을 더 정확하게 바로잡았습니다." },
  });
  fireEvent.click(screen.getByRole("button", { name: "수정 이력 남기고 저장" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  expect(fetchMock.mock.calls[0]).toMatchObject([
    "/api/community/posts/10000000-0000-4000-8000-000000000001",
    { method: "PATCH", headers: { "Content-Type": "application/json" } },
  ]);
  expect(await screen.findByText("이전 내용을 수정 이력에 남기고 저장했습니다.")).toBeTruthy();
  expect(screen.queryByText("출처 재확인 기록 추가")).toBeNull();
  expect(refresh).toHaveBeenCalledOnce();
});

test("an operator can append only an HTTPS source recheck", () => {
  render(
    <CommunityPostActions
      postId="10000000-0000-4000-8000-000000000001"
      postTitle="운영 정정 대상"
      postBody="운영자가 사실 정보와 출처를 다시 확인할 게시글 본문입니다."
      source={{ label: "기존 안내", url: "https://example.com/old", checkedAt: "2026-01-01" }}
      boardId="general"
      signedIn
      canCorrect
      isOperator
      canDelete
      initiallyBookmarked={false}
    />,
  );
  fireEvent.click(screen.getByText("글 수정·정정"));
  expect(screen.getByLabelText("출처 재확인 기록 추가")).toBeTruthy();
  fireEvent.click(screen.getByLabelText("출처 재확인 기록 추가"));
  const sourceUrl = screen.getByLabelText(/^공개 원문 URL/);
  expect(sourceUrl.getAttribute("pattern")).toBe("https://.*");
  expect(screen.getByText("HTTPS로 공개된 원문만 재확인 기록에 남길 수 있습니다.")).toBeTruthy();
});

test("operator correction remains available without artist participation controls", () => {
  render(
    <CommunityPostActions
      postId="10000000-0000-4000-8000-000000000001"
      postTitle="운영 정정 대상"
      postBody="운영자가 사실 정보를 바로잡을 게시글 본문입니다."
      boardId="artists"
      signedIn
      canParticipate={false}
      canCorrect
      isOperator
      canDelete
      initiallyBookmarked={false}
    />,
  );

  expect(screen.getByText("글 수정·정정")).toBeTruthy();
  expect(screen.queryByLabelText("댓글")).toBeNull();
  expect(screen.queryByRole("link", { name: "이 글 신고" })).toBeNull();
  expect(
    screen.getByText(/운영 열람 상태에서는 댓글·신고·계정 Binder 변경 없이/),
  ).toBeTruthy();
});

test("inactive signed-in members receive no live mutation controls", () => {
  render(
    <CommunityPostActions
      postId="10000000-0000-4000-8000-000000000001"
      postTitle="읽기 전용 대상"
      boardId="general"
      signedIn
      canParticipate={false}
      canDelete={false}
      initiallyBookmarked={false}
    />,
  );

  expect(screen.getByText(/현재 계정 상태에서는 댓글·신고·계정 Binder 변경/)).toBeTruthy();
  expect(screen.queryByLabelText("댓글")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});
