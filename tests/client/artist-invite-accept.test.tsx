import type { AnchorHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { ArtistInviteAcceptForm } from "../../app/components/ArtistInviteAcceptForm";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

test("keeps invitation acceptance disabled until current-policy consent is explicit", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ ok: true, code: "accepted" }),
  );

  render(
    <ArtistInviteAcceptForm
      token="invite-token"
      currentPolicyVersion="community-2026-07"
    />,
  );

  const acceptButton = screen.getByRole("button", { name: "작가 초대 수락" });
  expect((acceptButton as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("community-2026-07")).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("checkbox", { name: /현재 커뮤니티 운영 규칙/ }));
  expect((acceptButton as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(acceptButton);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/community/invitations/invite-token/accept",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        policyConsent: true,
        policyVersion: "community-2026-07",
      }),
    },
  );
});
