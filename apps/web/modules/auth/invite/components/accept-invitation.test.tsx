import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { AcceptInvitation } from "./accept-invitation";

const mocks = vi.hoisted(() => ({ acceptInvite: vi.fn() }));

vi.mock("@/modules/auth/invite/lib/api-client", () => ({ acceptInvite: mocks.acceptInvite }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const accept = () => fireEvent.click(screen.getByRole("button", { name: "auth.invite.accept_invitation" }));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("AcceptInvitation", () => {
  test("joins nothing until the user accepts", () => {
    render(<AcceptInvitation token="invite-token" />);

    expect(screen.getByText("auth.invite.you_are_invited")).toBeInTheDocument();
    expect(mocks.acceptInvite).not.toHaveBeenCalled();
  });

  test("accepts with the page's token, then welcomes the user with a way into the app", async () => {
    mocks.acceptInvite.mockResolvedValue({ organizationId: "org-1", role: "member" });
    render(<AcceptInvitation token="invite-token" />);

    accept();

    expect(await screen.findByText("auth.invite.welcome_to_organization")).toBeInTheDocument();
    expect(mocks.acceptInvite).toHaveBeenCalledWith("invite-token");
    expect(screen.getByRole("link", { name: "auth.invite.go_to_app" })).toHaveAttribute("href", "/");
  });

  test.each([
    [
      "an existing membership",
      new V3ApiError({ status: 409, detail: "", details: { reason: "already_member" } }),
      "auth.invite.already_a_member",
    ],
    [
      "an expired invite",
      new V3ApiError({ status: 422, detail: "", details: { reason: "invite_expired" } }),
      "auth.invite.invite_expired",
    ],
    [
      "an invite no longer valid for this user",
      new V3ApiError({ status: 403, detail: "" }),
      "auth.invite.invite_not_found",
    ],
  ])("explains %s", async (_label, error, headline) => {
    mocks.acceptInvite.mockRejectedValue(error);
    render(<AcceptInvitation token="invite-token" />);

    accept();

    expect(await screen.findByText(headline)).toBeInTheDocument();
  });

  test("keeps the button, with an error, when the request fails for another reason", async () => {
    mocks.acceptInvite.mockRejectedValue(new V3ApiError({ status: 0, detail: "" }));
    render(<AcceptInvitation token="invite-token" />);

    accept();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "common.something_went_wrong_please_try_again"
    );
    expect(screen.getByRole("button", { name: "auth.invite.accept_invitation" })).toBeEnabled();
  });
});
