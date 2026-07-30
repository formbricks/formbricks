import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { hashSecret } from "@/lib/crypto";
import { auth } from "@/modules/auth/lib/auth";
import * as auditHandler from "@/modules/ee/audit-logs/lib/handler";

// Capture audit emission without running the real background audit logging (DB writes via setImmediate).
vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>();
  return { ...actual, queueAuditEventBackground: vi.fn() };
});

// Bypass the Redis-backed failed-login rate-limit gate so the wiring is exercised deterministically
// (the gate's own throttling logic is unit-tested in utils). logAuthAttempt stays real.
vi.mock("@/modules/auth/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/auth/lib/utils")>();
  return { ...actual, shouldLogAuthFailure: vi.fn().mockResolvedValue(true) };
});

/**
 * Integration coverage for the Phase 7 observability parity (ENG-1054) against real Postgres: a
 * successful Better Auth sign-in emits the same `signedIn` audit event the NextAuth route did, via the
 * session.create.after database hook (better-auth-observability.ts).
 */
beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("Observability — signedIn audit on session creation (real Postgres)", () => {
  test("a successful password sign-in emits a signedIn success audit event", async () => {
    const password = "Observe-Me1!";
    const user = await prisma.user.create({
      data: {
        email: "observe@example.com",
        name: "Observe",
        emailVerified: true,
        password: await hashSecret(password),
      },
    });
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "credential",
        provider: "credential",
        providerAccountId: user.id,
        password: user.password!,
      },
    });

    const res = await auth.api.signInEmail({
      body: { email: "observe@example.com", password },
      asResponse: true,
    });
    expect(res.status).toBe(200);

    expect(auditHandler.queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "signedIn",
        status: "success",
        userId: user.id,
        targetId: user.id,
        newObject: expect.objectContaining({ authMethod: "password", sessionStrategy: "database" }),
      })
    );
  });
});

describe("Observability — failed-login audit on a rejected sign-in (real Postgres)", () => {
  test("a wrong-password sign-in emits an authenticationAttempted failure audit", async () => {
    const password = "Observe-Me1!";
    const user = await prisma.user.create({
      data: {
        email: "observe-fail@example.com",
        name: "Observe Fail",
        emailVerified: true,
        password: await hashSecret(password),
      },
    });
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "credential",
        provider: "credential",
        providerAccountId: user.id,
        password: user.password!,
      },
    });

    const res = await auth.api.signInEmail({
      body: { email: "observe-fail@example.com", password: "Wrong-Password9!" },
      asResponse: true,
    });
    expect(res.status).toBe(401);

    // The composed hooks.after ran auditFailedAuthAfter → (real) logAuthAttempt → the failed-login
    // audit: action authenticationAttempted, status failure.
    expect(auditHandler.queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "authenticationAttempted",
        status: "failure",
        newObject: expect.objectContaining({ provider: "credentials", authMethod: "password" }),
      })
    );
    // Parity guard: the raw email is hashed into the actor id, never stored in the audit payload.
    const payloads = vi
      .mocked(auditHandler.queueAuditEventBackground)
      .mock.calls.map((call) => JSON.stringify(call[0]));
    expect(payloads.some((payload) => payload.includes("observe-fail@example.com"))).toBe(false);
  });
});
