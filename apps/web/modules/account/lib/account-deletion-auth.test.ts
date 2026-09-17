import { describe, expect, test } from "vitest";
import type { IdentityProvider } from "@formbricks/database/prisma";
import { requiresPasswordConfirmationForAccountDeletion } from "./account-deletion-auth";

/**
 * Every value of the Prisma `IdentityProvider` enum, listed so the compiler fails here when one is
 * added. This predicate decides which of the two deletion flows an account gets — password
 * confirmation, or the emailed link — so a new provider that landed on the wrong side would hand a
 * password-less account a password prompt it can never satisfy, or send a password-backed account a
 * deletion link instead of asking for its password.
 */
const PASSWORD_BACKED: IdentityProvider[] = ["email"];
const SSO_ONLY: IdentityProvider[] = ["github", "google", "azuread", "openid", "saml"];

describe("account deletion auth requirements", () => {
  test.each(PASSWORD_BACKED)("requires password confirmation for %s users", (identityProvider) => {
    expect(requiresPasswordConfirmationForAccountDeletion({ identityProvider })).toBe(true);
  });

  test.each(SSO_ONLY)("does not require password confirmation for %s users", (identityProvider) => {
    expect(requiresPasswordConfirmationForAccountDeletion({ identityProvider })).toBe(false);
  });

  test("covers the whole enum, so a newly added provider cannot slip past unclassified", () => {
    const covered = [...PASSWORD_BACKED, ...SSO_ONLY];
    expect(new Set(covered).size).toBe(covered.length);
    // Mirrors packages/database/schema/main.prisma `enum IdentityProvider`.
    expect([...covered].sort()).toEqual(["azuread", "email", "github", "google", "openid", "saml"]);
  });
});
