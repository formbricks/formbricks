import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { hashSecret } from "@/lib/crypto";
// eslint-disable-next-line import/first
import { auth } from "@/modules/auth/lib/auth";
// eslint-disable-next-line import/first -- must import after the vi.mock above is registered
import * as auditHandler from "@/modules/ee/audit-logs/lib/handler";

// Capture audit emission without running the real background audit logging (DB writes via setImmediate).
vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>();
  return { ...actual, queueAuditEventBackground: vi.fn() };
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
