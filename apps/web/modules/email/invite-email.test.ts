import { beforeEach, describe, expect, test, vi } from "vitest";
import { sendInviteMemberEmail } from "./index";

const mocks = vi.hoisted(() => ({
  renderInviteEmail: vi.fn(async () => "html"),
  sendEmail: vi.fn(),
}));

vi.mock("@/modules/email/lib/send-email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lingodotdev/server", () => ({
  getTranslate: async () => (key: string) => (key === "common.anonymous" ? "Anonymous" : key),
}));
vi.mock("@/lib/jwt", () => ({
  createToken: () => "token",
  createEmailToken: () => "token",
  createEmailChangeToken: () => "token",
  createInviteToken: () => "token",
  createTokenForLinkSurvey: () => "token",
}));
vi.mock("@/lib/organization/service", () => ({ getOrganizationByWorkspaceId: async () => ({ id: "org" }) }));
vi.mock("@/lib/responses", () => ({ getElementResponseMapping: () => [] }));
vi.mock("@/modules/email/lib/survey-response-email", () => ({
  buildSurveyResponseEmailHtml: async () => "<p>Body</p>",
}));
vi.mock("@formbricks/email", () => ({
  renderInviteEmail: mocks.renderInviteEmail,
}));

const renderedNames = () => {
  const [args] = mocks.renderInviteEmail.mock.calls.at(-1) as unknown as [
    { inviterName: string; inviteeName: string },
  ];
  return { inviterName: args.inviterName, inviteeName: args.inviteeName };
};

describe("sendInviteMemberEmail display names", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("passes an ordinary inviter and invitee name through unchanged", async () => {
    await sendInviteMemberEmail("invite", "to@example.com", "Anna Müller", "Ben");

    expect(renderedNames()).toEqual({ inviterName: "Anna Müller", inviteeName: "Ben" });
  });

  test("strips links from the inviter name and bounds its length", async () => {
    await sendInviteMemberEmail(
      "invite",
      "to@example.com",
      `Win now https://spam.example/claim ${"x".repeat(200)}`,
      ""
    );

    const { inviterName, inviteeName } = renderedNames();
    expect(inviterName).not.toContain("https://");
    expect(Array.from(inviterName).length).toBeLessThanOrEqual(60);
    expect(inviteeName).toBe("");
  });

  test("uses the translated anonymous label when the inviter name has nothing displayable", async () => {
    await sendInviteMemberEmail("invite", "to@example.com", "https://spam.example", "");

    expect(renderedNames().inviterName).toBe("Anonymous");
  });
});
