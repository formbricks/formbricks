import { describe, expect, test } from "vitest";
import { requirePasswordResetEnabledBeforeHandler } from "./better-auth-password-reset-gate";

describe("requirePasswordResetEnabledBeforeHandler (ENG-2105 password-reset disabled gate)", () => {
  test("allows all paths when password reset is NOT disabled", async () => {
    await expect(
      requirePasswordResetEnabledBeforeHandler({ path: "/request-password-reset" }, false)
    ).resolves.toBeUndefined();

    await expect(
      requirePasswordResetEnabledBeforeHandler({ path: "/reset-password" }, false)
    ).resolves.toBeUndefined();

    await expect(
      requirePasswordResetEnabledBeforeHandler({ path: "/sign-in/email" }, false)
    ).resolves.toBeUndefined();
  });

  test("blocks /request-password-reset when password reset is disabled", async () => {
    await expect(
      requirePasswordResetEnabledBeforeHandler({ path: "/request-password-reset" }, true)
    ).rejects.toThrow("Password reset is disabled");
  });

  test("blocks /reset-password when password reset is disabled", async () => {
    await expect(requirePasswordResetEnabledBeforeHandler({ path: "/reset-password" }, true)).rejects.toThrow(
      "Password reset is disabled"
    );
  });

  test("allows other paths even when password reset is disabled", async () => {
    await expect(
      requirePasswordResetEnabledBeforeHandler({ path: "/sign-in/email" }, true)
    ).resolves.toBeUndefined();

    await expect(
      requirePasswordResetEnabledBeforeHandler({ path: "/sign-up/email" }, true)
    ).resolves.toBeUndefined();

    await expect(
      requirePasswordResetEnabledBeforeHandler({ path: "/delete-user" }, true)
    ).resolves.toBeUndefined();
  });
});
