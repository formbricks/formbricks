import { isAPIError } from "better-auth/api";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { buildReencodedTwoFactorData } from "@/modules/auth/lib/cutover/reencode-two-factor";
import { twoFactorBackfillAfterHandler } from "./better-auth-two-factor-backfill";

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    twoFactor: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("better-auth/api", () => ({ isAPIError: vi.fn() }));

vi.mock("@/modules/auth/lib/auth", () => ({
  auth: { $context: Promise.resolve({ secretConfig: "ba-secret-config" }) },
}));

vi.mock("@/modules/auth/lib/cutover/reencode-two-factor", () => ({
  buildReencodedTwoFactorData: vi.fn(),
}));

// Minimal AuthHookContext for a successful /sign-in/email of a legacy-2FA user.
const ctx = (overrides: Record<string, unknown> = {}) =>
  ({
    path: "/sign-in/email",
    body: { email: "user@example.com" },
    context: { returned: { twoFactorRedirect: true } },
    ...overrides,
  }) as any;

describe("twoFactorBackfillAfterHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAPIError).mockReturnValue(false); // success by default
    vi.mocked(buildReencodedTwoFactorData).mockResolvedValue({
      secret: "ba-secret",
      backupCodes: "ba-codes",
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      twoFactorEnabled: true,
      twoFactorSecret: "encrypted_secret",
      backupCodes: "encrypted_codes",
    } as any);
    vi.mocked(prisma.twoFactor.findUnique).mockResolvedValue(null); // no BA row yet
  });

  test("backfills the TwoFactor row for a legacy-enrolled user on successful sign-in", async () => {
    await twoFactorBackfillAfterHandler(ctx());

    expect(buildReencodedTwoFactorData).toHaveBeenCalledWith(
      "encrypted_secret",
      "encrypted_codes",
      "ba-secret-config"
    );
    expect(prisma.twoFactor.upsert).toHaveBeenCalledWith({
      where: { userId: "user123" },
      update: { secret: "ba-secret", backupCodes: "ba-codes", verified: true },
      create: { userId: "user123", secret: "ba-secret", backupCodes: "ba-codes", verified: true },
    });
  });

  test("no-op on a non-sign-in path", async () => {
    await twoFactorBackfillAfterHandler(ctx({ path: "/two-factor/verify-totp" }));
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.twoFactor.upsert).not.toHaveBeenCalled();
  });

  test("no-op on a failed sign-in (APIError) — never a pre-auth write", async () => {
    vi.mocked(isAPIError).mockReturnValue(true);
    await twoFactorBackfillAfterHandler(ctx({ context: { returned: { message: "bad password" } } }));
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.twoFactor.upsert).not.toHaveBeenCalled();
  });

  test("no-op when the user already has a TwoFactor row", async () => {
    vi.mocked(prisma.twoFactor.findUnique).mockResolvedValue({ id: "tf1" } as any);
    await twoFactorBackfillAfterHandler(ctx());
    expect(prisma.twoFactor.upsert).not.toHaveBeenCalled();
  });

  test("no-op for a non-2FA / SSO user (no legacy secret or flag off)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "sso1",
      twoFactorEnabled: false,
      twoFactorSecret: null,
      backupCodes: null,
    } as any);
    await twoFactorBackfillAfterHandler(ctx());
    expect(prisma.twoFactor.upsert).not.toHaveBeenCalled();
  });
});
