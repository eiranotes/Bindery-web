import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import {
  COMMUNITY_DRAFT_KEY,
  CommunityComposer,
  parseCommunityDraft,
} from "../../app/components/CommunityComposer";

function fillDraft() {
  fireEvent.change(screen.getByLabelText(/^글 분류/), {
    target: { value: "production" },
  });
  fireEvent.change(screen.getByLabelText("제목"), {
    target: { value: "스티커 교정본 확인 순서" },
  });
  fireEvent.change(screen.getByLabelText(/^본문/), {
    target: {
      value:
        "칼선과 흰색 인쇄 레이어를 어떤 순서로 확인하는지 경험을 정리합니다.",
    },
  });
  fireEvent.change(screen.getByLabelText(/참고 원문 URL/), {
    target: { value: "https://example.com/source" },
  });
}

test("draft saves locally, restores, and clears without implying publication", async () => {
  const firstRender = render(<CommunityComposer />);
  expect(
    screen.getByText(/암호화·자동 삭제되지 않습니다/),
  ).toBeTruthy();
  fillDraft();

  fireEvent.click(
    screen.getByRole("button", { name: "이 기기에 임시저장" }),
  );

  expect(
    await screen.findByText(/공개 게시되거나 전송되지 않지만 자동 삭제되지 않으므로/),
  ).toBeTruthy();
  const saved = parseCommunityDraft(
    window.localStorage.getItem(COMMUNITY_DRAFT_KEY),
  );
  expect(saved?.categoryId).toBe("production");
  expect(saved?.title).toBe("스티커 교정본 확인 순서");

  firstRender.unmount();
  render(<CommunityComposer />);

  expect(
    await screen.findByText("이 기기에 저장한 임시 글을 불러왔습니다."),
  ).toBeTruthy();
  expect(
    (screen.getByLabelText("제목") as HTMLInputElement).value,
  ).toBe("스티커 교정본 확인 순서");

  fireEvent.click(screen.getByRole("button", { name: "임시 글 지우기" }));
  fireEvent.click(
    screen.getByRole("button", { name: "정말 임시 글 지우기" }),
  );
  expect(
    await screen.findByText("이 기기에 저장한 임시 글을 지웠습니다."),
  ).toBeTruthy();
  expect(window.localStorage.getItem(COMMUNITY_DRAFT_KEY)).toBeNull();
});

test("malformed drafts fail closed", () => {
  expect(parseCommunityDraft(null)).toBeNull();
  expect(parseCommunityDraft("{")).toBeNull();
  expect(
    parseCommunityDraft(
      '{"version":0,"categoryId":"event","title":"x","body":"y","sourceUrl":"","savedAt":"z"}',
    ),
  ).toBeNull();
  expect(
    parseCommunityDraft(
      '{"version":1,"categoryId":"unknown","title":"x","body":"y","sourceUrl":"","savedAt":"z"}',
    ),
  ).toBeNull();
});

test("blocked draft restore reports the failure", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });

  render(<CommunityComposer />);

  expect(
    await screen.findByText(
      "브라우저 저장 공간을 사용할 수 없어 임시 글을 불러오지 못했습니다.",
    ),
  ).toBeTruthy();

  vi.restoreAllMocks();
});

test("blocked draft save reports the failure and keeps form content", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });

  render(<CommunityComposer />);
  fillDraft();
  fireEvent.click(
    screen.getByRole("button", { name: "이 기기에 임시저장" }),
  );

  expect(
    await screen.findByText(
      "브라우저 저장 공간을 사용할 수 없어 임시저장하지 못했습니다.",
    ),
  ).toBeTruthy();
  await waitFor(() => {
    expect(
      (screen.getByLabelText("제목") as HTMLInputElement).value,
    ).toBe("스티커 교정본 확인 순서");
  });

  vi.restoreAllMocks();
});

test("draft deletion can be canceled without losing form content", async () => {
  render(<CommunityComposer />);
  fillDraft();

  fireEvent.click(screen.getByRole("button", { name: "임시 글 지우기" }));
  expect(
    await screen.findByText(/저장된 임시 글을 지우려면/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "삭제 취소" }));

  expect(await screen.findByText("임시 글 삭제를 취소했습니다.")).toBeTruthy();
  expect((screen.getByLabelText("제목") as HTMLInputElement).value).toBe(
    "스티커 교정본 확인 순서",
  );
});

test("blocked draft removal reports the failure and keeps form content", async () => {
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });

  render(<CommunityComposer />);
  fillDraft();
  fireEvent.click(screen.getByRole("button", { name: "임시 글 지우기" }));
  fireEvent.click(
    screen.getByRole("button", { name: "정말 임시 글 지우기" }),
  );

  expect(
    await screen.findByText(
      "브라우저 저장 공간을 사용할 수 없어 임시 글을 지우지 못했습니다.",
    ),
  ).toBeTruthy();
  expect((screen.getByLabelText("제목") as HTMLInputElement).value).toBe(
    "스티커 교정본 확인 순서",
  );

  vi.restoreAllMocks();
});
