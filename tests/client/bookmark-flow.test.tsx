import type { AnchorHTMLAttributes } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { BinderClient } from "../../app/components/BinderClient";
import { BookmarkButton } from "../../app/components/BookmarkButton";
import { CommunityPostActions } from "../../app/components/CommunityPostActions";
import { BOOKMARK_STORAGE_KEY } from "../../app/lib/bookmarks";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

afterEach(() => {
  vi.restoreAllMocks();
});

test("save, same-tab sync, binder removal, and empty guidance stay connected", async () => {
  render(
    <>
      <BookmarkButton eventId="illustration-korea-2026-incheon" />
      <BinderClient />
    </>,
  );

  await screen.findByText("아직 꽂아 둔 페이지가 없습니다.");
  fireEvent.click(
    screen.getByRole("button", { name: "내 바인더에 넣기" }),
  );

  const savedRegion = await screen.findByRole("region", {
    name: "꽂아 둔 행사 1",
  });
  expect(within(savedRegion).getByText("2026 인천 일러스트코리아")).toBeTruthy();
  const toggleButton = screen
    .getAllByRole("button", { name: "내 바인더에서 빼기" })
    .find((button) => button.hasAttribute("aria-pressed"));
  expect(
    toggleButton?.getAttribute("aria-pressed"),
  ).toBe("true");

  fireEvent.click(
    within(savedRegion).getByRole("button", {
      name: "내 바인더에서 빼기",
    }),
  );

  await screen.findByText("아직 꽂아 둔 페이지가 없습니다.");
  await waitFor(() => {
    expect(
      screen
        .getByRole("button", { name: "내 바인더에 넣기" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });
  expect(window.localStorage.getItem(BOOKMARK_STORAGE_KEY)).toBe(
    '{"version":1,"eventIds":[],"communityPosts":[]}',
  );
});

test("a signed-out public reader saves a community post on this device", async () => {
  render(
    <CommunityPostActions
      postId="00000000-0000-4000-8000-000000000001"
      postTitle="공개 인쇄 질문"
      boardId="general"
      signedIn={false}
      canDelete={false}
      initiallyBookmarked={false}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "이 기기 Binder에 저장" }));
  expect(await screen.findByText("이 기기의 Binder에 저장했습니다.")).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(BOOKMARK_STORAGE_KEY) ?? "")).toEqual({
    version: 1,
    eventIds: [],
    communityPosts: [{
      id: "00000000-0000-4000-8000-000000000001",
      title: "공개 인쇄 질문",
      boardId: "general",
    }],
  });
});

test("explicit merge sends local events and posts while retaining both", async () => {
  const localRecord = JSON.stringify({
    version: 1,
    eventIds: ["illustration-korea-2026-incheon"],
    communityPosts: [{ id: "00000000-0000-4000-8000-000000000001", title: "공개 글", boardId: "general" }],
  });
  localStorage.setItem(BOOKMARK_STORAGE_KEY, localRecord);
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true, merged: [], conflicts: [{}, {}], rejected: [] }), { status: 200 }));
  render(<BinderClient syncState="signed_in" />);
  fireEvent.click(await screen.findByRole("button", { name: "계정 Binder와 합치기" }));
  await screen.findByText("2개 모두 이미 계정 Binder에 있습니다. 이 기기의 저장은 그대로 남아 있습니다.");
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ items: [
    { kind: "event", id: "illustration-korea-2026-incheon" },
    { kind: "community_post", id: "00000000-0000-4000-8000-000000000001" },
  ] });
  expect(localStorage.getItem(BOOKMARK_STORAGE_KEY)).toBe(localRecord);
});

test("account community posts render cross-device with their board link", async () => {
  render(<BinderClient syncState="signed_in" accountCommunityPosts={[{
    id: "00000000-0000-4000-8000-000000000001",
    title: "계정에 저장한 글",
    boardId: "general",
  }]} />);
  const link = await screen.findByRole("link", { name: "계정에 저장한 글" });
  expect(link.getAttribute("href")).toBe("/community/general/00000000-0000-4000-8000-000000000001");
  expect(screen.getByText("계정 Binder에 저장됨")).toBeTruthy();
});

test("blocked storage keeps the saved item and explains why removal failed", async () => {
  window.localStorage.setItem(
    BOOKMARK_STORAGE_KEY,
    '{"version":1,"eventIds":["illustration-korea-2026-incheon"]}',
  );
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });

  render(<BinderClient />);

  const savedRegion = await screen.findByRole("region", {
    name: "꽂아 둔 행사 1",
  });
  fireEvent.click(
    within(savedRegion).getByRole("button", {
      name: "내 바인더에서 빼기",
    }),
  );

  expect(
    await screen.findByText(
      "이 브라우저에서는 기기 저장소를 변경할 수 없습니다.",
    ),
  ).toBeTruthy();
  expect(within(savedRegion).getByText("2026 인천 일러스트코리아")).toBeTruthy();
});

test("a signed-in member explicitly merges local saves without clearing them", async () => {
  const localRecord =
    '{"version":1,"eventIds":["illustration-korea-2026-incheon"]}';
  window.localStorage.setItem(BOOKMARK_STORAGE_KEY, localRecord);
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        ok: true,
        code: "merged",
        merged: [{ kind: "event", id: "illustration-korea-2026-incheon" }],
        rejected: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );

  render(<BinderClient syncState="signed_in" />);
  await screen.findByRole("region", { name: "꽂아 둔 행사 1" });
  fireEvent.click(
    screen.getByRole("button", { name: "계정 Binder와 합치기" }),
  );

  expect(
    await screen.findByText(
      "계정 Binder와 1개를 합쳤습니다. 이 기기의 저장은 그대로 남아 있습니다.",
    ),
  ).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledOnce();
  const [, request] = fetchMock.mock.calls[0];
  expect(request).toMatchObject({
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  expect(JSON.parse(String(request?.body))).toEqual({
    items: [{ kind: "event", id: "illustration-korea-2026-incheon" }],
  });
  expect(window.localStorage.getItem(BOOKMARK_STORAGE_KEY)).toBe(localRecord);
});

test("a rejected account item remains local with an explicit partial result", async () => {
  const localRecord =
    '{"version":1,"eventIds":["illustration-korea-2026-incheon"]}';
  window.localStorage.setItem(BOOKMARK_STORAGE_KEY, localRecord);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        ok: false,
        code: "rejected",
        merged: [],
        rejected: [
          {
            item: { kind: "event", id: "illustration-korea-2026-incheon" },
            code: "service-error",
            message: "이 항목을 계정 Binder에 저장하지 못했습니다.",
          },
        ],
      }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    ),
  );

  render(<BinderClient syncState="signed_in" />);
  await screen.findByRole("region", { name: "꽂아 둔 행사 1" });
  fireEvent.click(
    screen.getByRole("button", { name: "계정 Binder와 합치기" }),
  );

  expect(
    await screen.findByText(
      "합치지 못한 1개 항목은 이 기기에 그대로 남아 있습니다.",
    ),
  ).toBeTruthy();
  expect(window.localStorage.getItem(BOOKMARK_STORAGE_KEY)).toBe(localRecord);
});

test("signed-out Binder stays local-only and never sends device saves", async () => {
  window.localStorage.setItem(
    BOOKMARK_STORAGE_KEY,
    '{"version":1,"eventIds":["illustration-korea-2026-incheon"]}',
  );
  const fetchMock = vi.spyOn(globalThis, "fetch");

  render(<BinderClient syncState="signed_out" />);

  await screen.findByRole("region", { name: "꽂아 둔 행사 1" });
  expect(
    screen.queryByRole("button", { name: "계정 Binder와 합치기" }),
  ).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a signed-in member sees account event saves on another device", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch");

  render(
    <BinderClient
      accountEventIds={["illustration-korea-2026-seoul-at"]}
      syncState="signed_in"
    />,
  );

  const savedRegion = await screen.findByRole("region", {
    name: "꽂아 둔 행사 1",
  });
  expect(
    within(savedRegion).getByText("2026 서울 일러스트코리아 (aT센터)"),
  ).toBeTruthy();
  expect(
    within(savedRegion).queryByRole("button", {
      name: "내 바인더에서 빼기",
    }),
  ).toBeNull();
  expect(within(savedRegion).getByText("계정 Binder에 저장됨")).toBeTruthy();
  expect(window.localStorage.getItem(BOOKMARK_STORAGE_KEY)).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});
