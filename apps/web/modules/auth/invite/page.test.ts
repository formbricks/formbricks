import type { ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AcceptInvitation } from "./components/accept-invitation";
import { ContentLayout } from "./components/content-layout";
import { InvitePage } from "./page";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  verifyInviteToken: vi.fn(),
  getInvite: vi.fn(),
}));

vi.mock("@/lingodotdev/server", () => ({ getTranslate: async () => (key: string) => key }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/user/service", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/jwt", () => ({ verifyInviteToken: mocks.verifyInviteToken }));
vi.mock("@/modules/auth/invite/lib/invite", () => ({ getInvite: mocks.getInvite }));
vi.mock("@/lib/constants", () => ({ WEBAPP_URL: "http://localhost:3000" }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));

type TPageElement = ReactElement<{ headline?: string; token?: string }>;

const renderPage = async () =>
  (await InvitePage({ searchParams: Promise.resolve({ token: "invite-token" }) })) as TPageElement;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
  mocks.getUser.mockResolvedValue({ id: "user-1", email: "Invitee@example.com" });
  mocks.verifyInviteToken.mockReturnValue({ inviteId: "invite-1", email: "invitee@example.com" });
  mocks.getInvite.mockResolvedValue({ id: "invite-1", expiresAt: new Date(Date.now() + 60_000) });
});

describe("InvitePage", () => {
  test("offers the invited, signed-in user the Accept button with the link's token, and joins nothing", async () => {
    const page = await renderPage();

    expect(page.type).toBe(AcceptInvitation);
    expect(page.props.token).toBe("invite-token");
  });

  test.each([
    [
      "a token that does not verify",
      () =>
        mocks.verifyInviteToken.mockImplementation(() => {
          throw new Error("bad");
        }),
      "auth.invite.invite_not_found",
    ],
    ["a missing invite", () => mocks.getInvite.mockResolvedValue(null), "auth.invite.invite_not_found"],
    [
      "an expired invite",
      () => mocks.getInvite.mockResolvedValue({ id: "invite-1", expiresAt: new Date(0) }),
      "auth.invite.invite_expired",
    ],
    ["no session", () => mocks.getSession.mockResolvedValue(null), "auth.invite.happy_to_have_you"],
    [
      "another user",
      () => mocks.getUser.mockResolvedValue({ id: "user-1", email: "other@example.com" }),
      "auth.invite.email_does_not_match",
    ],
  ])("keeps its own screen for %s", async (_label, arrange, headline) => {
    arrange();

    const page = await renderPage();

    expect(page.type).toBe(ContentLayout);
    expect(page.props.headline).toBe(headline);
  });
});
