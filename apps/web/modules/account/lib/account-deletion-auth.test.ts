import { describe, expect, test } from "vitest";
import { requiresPasswordConfirmationForAccountDeletion } from "./account-deletion-auth";

describe("account deletion auth requirements", () => {
  test("requires password confirmation for password-backed users", () => {
    expect(requiresPasswordConfirmationForAccountDeletion({ identityProvider: "email" })).toBe(true);
  });

  test("does not require password confirmation for SSO-only users", () => {
    expect(requiresPasswordConfirmationForAccountDeletion({ identityProvider: "google" })).toBe(false);
  });
});
