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

afterEach(() => {
  vi.restoreAllMocks();
});

test("save, same-tab sync, binder removal, and empty guidance stay connected", async () => {
  render(
    <>
      <BookmarkButton eventId="illustar-2026-winter" />
      <BinderClient />
    </>,
  );

  await screen.findByText("아직 꽂아 둔 행사가 없습니다.");
  fireEvent.click(
    screen.getByRole("button", { name: "내 바인더에 넣기" }),
  );

  const savedRegion = await screen.findByRole("region", {
    name: "꽂아 둔 행사 1",
  });
  expect(within(savedRegion).getByText("일러스타페어 2026 겨울")).toBeTruthy();
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

  await screen.findByText("아직 꽂아 둔 행사가 없습니다.");
  await waitFor(() => {
    expect(
      screen
        .getByRole("button", { name: "내 바인더에 넣기" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });
  expect(window.localStorage.getItem(BOOKMARK_STORAGE_KEY)).toBe(
    '{"version":1,"eventIds":[]}',
  );
});

test("blocked storage keeps the saved item and explains why removal failed", async () => {
  window.localStorage.setItem(
    BOOKMARK_STORAGE_KEY,
    '{"version":1,"eventIds":["illustar-2026-winter"]}',
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
  expect(within(savedRegion).getByText("일러스타페어 2026 겨울")).toBeTruthy();
});
