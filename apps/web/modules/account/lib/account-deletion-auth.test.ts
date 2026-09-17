import { describe, expect, test } from "vitest";
import { IdentityProvider } from "@formbricks/database/prisma";
import { requiresPasswordConfirmationForAccountDeletion } from "./account-deletion-auth";

/**
 * Every value of the Prisma `IdentityProvider` enum, split by which of the two deletion flows it gets:
 * password confirmation, or the emailed link. A provider on the wrong side would hand a password-less
 * account a password prompt it can never satisfy, or send a password-backed account a deletion link
 * instead of asking for its password.
 *
 * The exhaustiveness check below compares against the RUNTIME enum, not the type. Annotating these as
 * `IdentityProvider[]` only rejects values that are not providers — it does not require every provider
 * to appear, so a newly added one would leave both lists type-correct and unclassified.
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
    expect(new Set(covered).size).toBe(covered.length); // no provider classified twice
    expect([...covered].sort()).toEqual([...Object.values(IdentityProvider)].sort());
  });
});
