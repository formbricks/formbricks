import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { POST } from "@/app/api/auth/[...all]/route";
import { resetDb } from "@/integration/reset-db";
import { provisionSsoUserMemberships } from "@/modules/ee/sso/lib/sso-provisioning";
import { auth } from "./auth";

const settings = vi.hoisted(() => ({ enabled: true }));
vi.mock("@/lib/constants", async (original) => ({
  ...(await original<typeof import("@/lib/constants")>()),
  get AUDIT_LOG_ENABLED() {
    return settings.enabled;
  },
}));
const cookies = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
const password = "Integration-Private-Pass123!";
const signIn = async () => {
  await auth.api.signUpEmail({ body: { email: "audit@example.com", name: "Audit User", password } });
  const user = await prisma.user.update({
    where: { email: "audit@example.com" },
    data: { emailVerified: true },
  });
  const response = await auth.api.signInEmail({ body: { email: user.email, password }, asResponse: true });
  await new Promise((resolve) => setImmediate(resolve));
  vi.mocked(logger.audit).mockClear();
  return { user, cookie: cookies(response) };
};
const post = (path: string, cookie = "", body: Record<string, unknown> = {}) =>
  POST(
    new Request(`http://localhost:3000/api/auth/${path}`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
beforeEach(async () => {
  await resetDb();
  settings.enabled = true;
  vi.spyOn(logger, "audit").mockImplementation(() => {});
  vi.clearAllMocks();
});

describe("production auth composition / actual catch-all route", () => {
  test("profile mutation and sign-out use the persisted session principal and final sink", async () => {
    const { user, cookie } = await signIn();
    const response = await post("update-user", cookie, { name: "Changed User", userId: "forged-principal" });
    expect(response.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.name).toBe("Changed User");
    expect(logger.audit).toHaveBeenLastCalledWith(
      expect.objectContaining({ actor: { type: "user", id: user.id }, scope: "global", status: "success" })
    );
    const out = await post("sign-out", cookie, { userId: "forged-principal" });
    expect(out.status).toBe(200);
    expect(await prisma.session.count()).toBe(0);
    expect(logger.audit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "userSignedOut",
        actor: { type: "user", id: user.id },
        status: "success",
      })
    );
    expect(JSON.stringify(vi.mocked(logger.audit).mock.calls)).not.toMatch(
      /forged-principal|Changed User|Integration-Private/
    );
  });
  test("credential failure counts reach the final sink without duplicate native events", async () => {
    const email = `${randomUUID()}@example.com`;
    for (let index = 0; index < 4; index++) {
      const response = await post("sign-in/email", "", { email, password: "Unknown-user-password123!" });
      expect(response.status).toBe(401);
    }
    await new Promise((resolve) => setImmediate(resolve));
    const events = vi.mocked(logger.audit).mock.calls.map(([event]) => event);
    expect(events).toHaveLength(3);
    expect(events).toEqual(
      [1, 2, 3].map((attemptCount) =>
        expect.objectContaining({
          action: "authenticationAttempted",
          actor: { type: "anonymous", id: expect.stringMatching(/^email_/) },
          scope: "global",
          status: "failure",
          requestId: expect.any(String),
          changes: expect.objectContaining({ attemptCount, suppressedCount: 0 }),
        })
      )
    );
    expect(JSON.stringify(events)).not.toContain(email);
  });
  test("DCR redirect rejection before Better Auth emits a denial", async () => {
    const response = await post("oauth2/register", "", {
      redirect_uris: ["https://external.example/callback"],
      application_type: "native",
    });
    expect(response.status).toBe(400);
    expect(logger.audit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "denied",
        scope: "global",
        changes: { operation: "oauth2/register", reason: "redirect_uri_denied", httpStatus: 400 },
      })
    );
  });
  test("native origin/session denial, disabled auditing and logger failure preserve responses", async () => {
    const denied = await post("update-user", "", { name: "Attempt" });
    expect(denied.status).toBe(401);
    expect(logger.audit).toHaveBeenLastCalledWith(expect.objectContaining({ status: "denied" }));
    const { user, cookie } = await signIn();
    settings.enabled = false;
    expect((await post("update-user", cookie, { name: "Disabled" })).status).toBe(200);
    expect(logger.audit).not.toHaveBeenCalled();
    settings.enabled = true;
    vi.mocked(logger.audit).mockImplementation(() => {
      throw new Error("sink failed");
    });
    expect((await post("update-user", cookie, { name: "Final" })).status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.name).toBe("Final");
  });
});

describe("SSO membership assignment final events", () => {
  test("reports committed grants and treats an idempotent replay as a no-op", async () => {
    const user = await prisma.user.create({ data: { name: "SSO User", email: "sso@example.com" } });
    const organization = await prisma.organization.create({ data: { name: "SSO organization" } });
    const args = {
      userId: user.id,
      email: user.email,
      provider: "google" as const,
      organizationId: organization.id,
      assignToDefaultTeam: false,
      signupSource: "direct" as const,
    };
    await provisionSsoUserMemberships(args);
    expect(await prisma.membership.count()).toBe(1);
    expect(logger.audit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actor: { id: "sso", type: "system" },
        organizationId: organization.id,
        scope: "organization",
        status: "success",
        changes: expect.objectContaining({
          subjectId: user.id,
          beforeRole: null,
          afterRole: "member",
          accepted: true,
        }),
      })
    );
    await provisionSsoUserMemberships(args);
    expect(logger.audit).toHaveBeenLastCalledWith(expect.objectContaining({ status: "noop" }));
    expect(JSON.stringify(vi.mocked(logger.audit).mock.calls)).not.toMatch(/SSO User|sso@example/);
  });
  test("a failed grant emits failure after retries without inventing a membership", async () => {
    const organization = await prisma.organization.create({ data: { name: "SSO organization" } });
    await provisionSsoUserMemberships({
      userId: "missing-user",
      email: "sso@example.com",
      provider: "google",
      organizationId: organization.id,
      assignToDefaultTeam: false,
      signupSource: "direct",
    });
    expect(await prisma.membership.count()).toBe(0);
    expect(logger.audit).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "failure", changes: { operation: "sso_membership_assignment" } })
    );
  });
});
