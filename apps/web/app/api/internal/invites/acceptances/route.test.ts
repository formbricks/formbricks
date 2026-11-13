import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { EMAILED_TOKEN_MAX } from "@/app/api/internal/lib/limits";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  findCommittedMembership: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  transaction: vi.fn(),
  verifyInviteToken: vi.fn(),
  getInvite: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  createMembership: vi.fn(),
  createTeamMembership: vi.fn(),
  reconcileOrganizationMembership: vi.fn(),
  reconcileTeamWorkspaceRelationships: vi.fn(),
  sendInviteAcceptedEmail: vi.fn(),
  deleteInvites: vi.fn(),
  findMembership: vi.fn(),
  log: [] as string[],
}));

vi.mock("@formbricks/database", () => ({
  prisma: { $transaction: mocks.transaction, membership: { findUnique: mocks.findCommittedMembership } },
}));
vi.mock("@/lib/jwt", () => ({ verifyInviteToken: mocks.verifyInviteToken }));
vi.mock("@/modules/auth/invite/lib/invite", () => ({ getInvite: mocks.getInvite }));
vi.mock("@/lib/user/service", () => ({ getUser: mocks.getUser, updateUser: mocks.updateUser }));
vi.mock("@/lib/membership/service", () => ({ createMembership: mocks.createMembership }));
vi.mock("@/modules/auth/signup/lib/team", () => ({ createTeamMembership: mocks.createTeamMembership }));
vi.mock("@/lib/authzed/organization-membership", () => ({
  reconcileOrganizationMembership: mocks.reconcileOrganizationMembership,
}));
vi.mock("@/lib/authzed/team-workspace", () => ({
  reconcileTeamWorkspaceRelationships: mocks.reconcileTeamWorkspaceRelationships,
}));
vi.mock("@/modules/email", () => ({ sendInviteAcceptedEmail: mocks.sendInviteAcceptedEmail }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cm9gptbhg0001192zceq9ayud";
const ORG_ID = "cm9gptbhg0000192zceq9ayuc";
const INVITE_ID = "6f1c7c1e-8f7a-4c5d-9a8b-0d2f3e4a5b6c";
const TEAM_ID = "cm9gptbhg0004192zceq9ayug";

const invite = (overrides: Record<string, unknown> = {}) => ({
  id: INVITE_ID,
  expiresAt: new Date(Date.now() + 86_400_000),
  organizationId: ORG_ID,
  role: "member",
  teamIds: [TEAM_ID],
  creator: { name: "Inviter", email: "inviter@example.com", locale: "en-US" },
  ...overrides,
});

const user = {
  id: USER_ID,
  name: "Invitee",
  email: "Invitee@Example.com",
  notificationSettings: { alert: {}, unsubscribedOrganizationIds: ["cm9gptbhg0009192zceq9ayux"] },
};

// The transaction runs its callback on a stand-in client; a throw is a rollback, so it records whether the
// callback finished (commit) or threw (rollback).
const TX = {
  invite: { deleteMany: mocks.deleteInvites },
  membership: { findUnique: mocks.findMembership },
};

const accept = (
  body: unknown = { token: "invite-token" },
  headers: Record<string, string> = SAME_ORIGIN_HEADERS
) =>
  POST(
    new NextRequest("http://localhost/api/internal/invites/acceptances", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    {} as never
  );

const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];

const expectNothingChanged = () => {
  expect(mocks.log).not.toContain("commit");
  expect(mocks.reconcileOrganizationMembership).not.toHaveBeenCalled();
  expect(mocks.sendInviteAcceptedEmail).not.toHaveBeenCalled();
  expect(mocks.updateUser).not.toHaveBeenCalled();
};

beforeEach(() => {
  mocks.findCommittedMembership.mockResolvedValue(null);
  vi.clearAllMocks();
  mocks.log.length = 0;
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.verifyInviteToken.mockReturnValue({ inviteId: INVITE_ID, email: "invitee@example.com" });
  mocks.getInvite.mockResolvedValue(invite());
  mocks.getUser.mockResolvedValue(user);
  mocks.deleteInvites.mockImplementation(async () => {
    mocks.log.push("deleteInvite");
    return { count: 1 };
  });
  mocks.findMembership.mockResolvedValue(null);
  mocks.createMembership.mockImplementation(async (organizationId: string, userId: string, data: object) => {
    mocks.log.push("createMembership");
    return { organizationId, userId, ...data };
  });
  mocks.createTeamMembership.mockImplementation(async () => {
    mocks.log.push("createTeamMembership");
  });
  mocks.transaction.mockImplementation(async (callback: (tx: typeof TX) => Promise<unknown>) => {
    try {
      const result = await callback(TX);
      mocks.log.push("commit");
      return result;
    } catch (error) {
      mocks.log.push("rollback");
      throw error;
    }
  });
  mocks.reconcileOrganizationMembership.mockImplementation(async () => {
    mocks.log.push("reconcileOrganization");
    return 1;
  });
  mocks.reconcileTeamWorkspaceRelationships.mockImplementation(async () => {
    mocks.log.push("reconcileTeams");
    return 1;
  });
  mocks.sendInviteAcceptedEmail.mockResolvedValue(undefined);
  mocks.updateUser.mockResolvedValue(user);
});

describe("POST /api/internal/invites/acceptances — accepting", () => {
  test("creates the membership with the invite's role, its teams, and spends the invite, in one transaction", async () => {
    const response = await accept();

    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual({ organizationId: ORG_ID, role: "member" });
    expect(mocks.log.slice(0, 4)).toEqual([
      "deleteInvite",
      "createMembership",
      "createTeamMembership",
      "commit",
    ]);
    expect(mocks.deleteInvites).toHaveBeenCalledWith({
      where: { id: INVITE_ID, organizationId: ORG_ID, expiresAt: { gt: expect.any(Date) } },
    });
    expect(mocks.createMembership).toHaveBeenCalledWith(
      ORG_ID,
      USER_ID,
      { accepted: true, role: "member" },
      { projection: "deferred", transaction: TX }
    );
    expect(mocks.createTeamMembership).toHaveBeenCalledWith(
      { organizationId: ORG_ID, role: "member", teamIds: [TEAM_ID] },
      USER_ID,
      { projection: "deferred", transaction: TX }
    );
  });

  test("projects the membership and its teams to SpiceDB only after the commit", async () => {
    await accept();

    const commit = mocks.log.indexOf("commit");
    expect(mocks.log.indexOf("reconcileOrganization")).toBeGreaterThan(commit);
    expect(mocks.log.indexOf("reconcileTeams")).toBeGreaterThan(commit);
    expect(mocks.reconcileOrganizationMembership).toHaveBeenCalledWith(ORG_ID, USER_ID);
    expect(mocks.reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({
      teamMemberships: [{ teamId: TEAM_ID, userId: USER_ID }],
    });
  });

  test("names no teams when the invite has none", async () => {
    mocks.getInvite.mockResolvedValue(invite({ teamIds: [] }));

    expect((await accept()).status).toBe(201);
    expect(mocks.createTeamMembership).not.toHaveBeenCalled();
    expect(mocks.reconcileTeamWorkspaceRelationships).not.toHaveBeenCalled();
  });

  test("emails the inviter and unsubscribes the new member from the organization's alerts", async () => {
    await accept();

    expect(mocks.sendInviteAcceptedEmail).toHaveBeenCalledWith(
      "Inviter",
      "Invitee",
      "inviter@example.com",
      "en-US",
      USER_ID,
      ORG_ID
    );
    expect(mocks.updateUser).toHaveBeenCalledWith(USER_ID, {
      notificationSettings: {
        alert: {},
        unsubscribedOrganizationIds: ["cm9gptbhg0009192zceq9ayux", ORG_ID],
      },
    });
  });

  test("still accepts when the email or the settings update fails: both are best-effort", async () => {
    mocks.sendInviteAcceptedEmail.mockRejectedValue(new Error("SMTP refused"));
    mocks.updateUser.mockRejectedValue(new Error("db hiccup"));

    expect((await accept()).status).toBe(201);
    expect(mocks.updateUser).toHaveBeenCalled();
  });

  test("audits the acceptance as a created membership, with the actor and the new membership", async () => {
    await accept();

    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "created",
        targetType: "membership",
        status: "success",
        userId: USER_ID,
        userType: "user",
        organizationId: ORG_ID,
        targetId: `${USER_ID}-${ORG_ID}`,
        newObject: {
          organizationId: ORG_ID,
          userId: USER_ID,
          accepted: true,
          role: "member",
          teamIds: [TEAM_ID],
        },
      })
    );
  });
});

describe("POST /api/internal/invites/acceptances — refusals", () => {
  // ENG-7097: accepting an invite must never overwrite a role the user already holds, e.g. demote an owner.
  test("refuses an organization the user already belongs to with 409, and rolls everything back", async () => {
    mocks.findMembership.mockResolvedValue({ userId: USER_ID });

    const response = await accept();

    expect(response.status).toBe(409);
    expect((await response.json()).details).toEqual({ reason: "already_member" });
    expect(mocks.createMembership).not.toHaveBeenCalled();
    expect(mocks.log).toContain("rollback");
    expectNothingChanged();
    expect(lastAudit()).toEqual(expect.objectContaining({ status: "failure", organizationId: ORG_ID }));
  });

  test("answers 409 when a concurrent acceptance of another invite created the membership first", async () => {
    // The insert loses the race on the membership's unique key; the service reports it as a database error.
    mocks.createMembership.mockRejectedValue(new Error("Unique constraint failed"));
    mocks.findCommittedMembership.mockResolvedValue({ userId: USER_ID });

    const response = await accept();

    expect(response.status).toBe(409);
    expect((await response.json()).details).toEqual({ reason: "already_member" });
    expect(mocks.log).toContain("rollback");
    expectNothingChanged();
  });

  test("refuses with the uniform 403 when the token does not verify", async () => {
    mocks.verifyInviteToken.mockImplementation(() => {
      throw new Error("Invalid or expired invite token");
    });

    expect((await accept()).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expectNothingChanged();
  });

  test("refuses with the uniform 403 when the invite is gone", async () => {
    mocks.getInvite.mockResolvedValue(null);

    expect((await accept()).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("refuses with the uniform 403 when the invite was sent to another address", async () => {
    mocks.verifyInviteToken.mockReturnValue({ inviteId: INVITE_ID, email: "someone-else@example.com" });

    expect((await accept()).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("matches the invited address without regard to case", async () => {
    mocks.verifyInviteToken.mockReturnValue({ inviteId: INVITE_ID, email: "INVITEE@example.COM" });

    expect((await accept()).status).toBe(201);
  });

  test("refuses an expired invite with 422 invite_expired", async () => {
    mocks.getInvite.mockResolvedValue(invite({ expiresAt: new Date(Date.now() - 1000) }));

    const response = await accept();

    expect(response.status).toBe(422);
    expect((await response.json()).details).toEqual({ reason: "invite_expired" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("refuses with 403 and rolls back when the invite was spent or expired after it was read", async () => {
    mocks.deleteInvites.mockResolvedValue({ count: 0 });

    expect((await accept()).status).toBe(403);
    expect(mocks.createMembership).not.toHaveBeenCalled();
    expect(mocks.log).toContain("rollback");
    expectNothingChanged();
  });

  test("answers 500 and changes nothing when a write in the transaction fails", async () => {
    mocks.createTeamMembership.mockRejectedValue(new Error("db down"));

    expect((await accept()).status).toBe(500);
    expect(mocks.log).toContain("rollback");
    expectNothingChanged();
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await accept()).status).toBe(401);
    expect(mocks.verifyInviteToken).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request", async () => {
    expect((await accept(undefined, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(mocks.verifyInviteToken).not.toHaveBeenCalled();
  });

  test.each([
    ["an empty token", { token: "" }],
    ["an over-long token", { token: "a".repeat(EMAILED_TOKEN_MAX + 1) }],
    ["an unknown key", { token: "invite-token", role: "owner" }],
  ])("refuses %s with 400", async (_label, body) => {
    expect((await accept(body)).status).toBe(400);
    expect(mocks.verifyInviteToken).not.toHaveBeenCalled();
  });
});
