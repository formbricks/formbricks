import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { getSsoRecoveryConfirmation } from "./recovery-authorize";
import { resolveSsoRecoveryConfirmView } from "./recovery-confirm";
import { SsoRecoveryError } from "./recovery-outcomes";

vi.mock("@formbricks/logger", () => {
  const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
  return { logger: { ...log, withContext: vi.fn(() => log) } };
});

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  WEBAPP_URL: "http://localhost:3000",
}));

// The guards themselves are tested in sso-recovery.test.ts; this file pins what the page does with their
// answer. The redirect mapping (`recovery-outcomes`) stays real so a refusal lands where the completion
// route would send it.
vi.mock("./recovery-authorize", () => ({ getSsoRecoveryConfirmation: vi.fn() }));

const anonymous = async () => ({});

describe("resolveSsoRecoveryConfirmView (ENG-7395)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("names the provider and the account it would change, from the same guards the POST runs", async () => {
    vi.mocked(getSsoRecoveryConfirmation).mockResolvedValue({
      provider: "google",
      email: "owner@example.com",
    });

    const view = await resolveSsoRecoveryConfirmView({
      state: "state-id",
      readBrowser: async () => ({ recoveryProof: "proof-value", sessionUserId: "user_1" }),
    });

    expect(getSsoRecoveryConfirmation).toHaveBeenCalledWith({
      stateId: "state-id",
      recoveryProof: "proof-value",
      sessionUserId: "user_1",
    });
    expect(view).toEqual({
      kind: "confirm",
      stateId: "state-id",
      providerName: "Google",
      email: "owner@example.com",
    });
  });

  test("shows nothing to a browser that never opened the emailed link", async () => {
    vi.mocked(getSsoRecoveryConfirmation).mockRejectedValue(new SsoRecoveryError("unproven"));

    await expect(
      resolveSsoRecoveryConfirmView({ state: "state-id", readBrowser: anonymous })
    ).resolves.toEqual({
      kind: "refused",
      redirectUrl: "http://localhost:3000/auth/login?error=sso_recovery_link_not_opened",
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("sends any other refusal to the ordinary failure page, without the intent's callback", async () => {
    vi.mocked(getSsoRecoveryConfirmation).mockRejectedValue(new SsoRecoveryError("rejected"));

    const view = await resolveSsoRecoveryConfirmView({
      state: "state-id",
      readBrowser: async () => ({ sessionUserId: "user_1" }),
    });

    expect(view).toMatchObject({ kind: "refused" });
    expect(view.kind === "refused" && view.redirectUrl).toContain("error=OAuthAccountNotLinked");
    expect(view.kind === "refused" && view.redirectUrl).not.toContain("callbackUrl=");
  });

  test("logs a failure that is not a guard's refusal", async () => {
    vi.mocked(getSsoRecoveryConfirmation).mockRejectedValue(new Error("redis exploded"));

    await expect(
      resolveSsoRecoveryConfirmView({ state: "state-id", readBrowser: anonymous })
    ).resolves.toMatchObject({
      kind: "refused",
    });
    // Through loggableError: name and frames, never the message.
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errName: "Error" }),
      "Unexpected error showing the SSO recovery confirmation"
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("redis exploded");
  });

  test.each([
    ["no state", undefined],
    ["an empty state", ""],
    ["a repeated state", ["a", "b"]],
  ])("refuses %s before reading anything", async (_label, state) => {
    const readBrowser = vi.fn(anonymous);

    const view = await resolveSsoRecoveryConfirmView({ state, readBrowser });

    expect(view.kind === "refused" && view.redirectUrl).toContain("error=OAuthAccountNotLinked");
    // Not even the session: a stateless hit costs no lookup and cannot fail on one.
    expect(readBrowser).not.toHaveBeenCalled();
    expect(getSsoRecoveryConfirmation).not.toHaveBeenCalled();
  });
});
