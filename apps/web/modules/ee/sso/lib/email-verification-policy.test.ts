import { describe, expect, test } from "vitest";
import {
  SSO_EMAIL_VERIFICATION_TRUST,
  resolveEmailVerifiedFromRawClaim,
  resolveSsoEmailVerifiedForCreate,
} from "./email-verification-policy";

/**
 * ENG-2589. The trust decision behind `User.emailVerified` on SSO sign-up, isolated from Better Auth
 * so the whole matrix is cheap to state: minting `true` for an address the IdP itself calls unproven
 * hands a squatter a verified account on someone else's email, while denying an address the IdP simply
 * never spoke about would break every self-hosted instance whose IdP omits the claim.
 */
describe("resolveEmailVerifiedFromRawClaim", () => {
  test.each([
    { claim: false, expected: false, label: "the IdP asserted the address is NOT verified" },
    { claim: "false", expected: false, label: "the same assertion serialized as a string" },
    { claim: true, expected: true, label: "the IdP attested the address" },
    { claim: "true", expected: true, label: "attestation serialized as a string" },
    { claim: undefined, expected: true, label: "absent — the IdP asserted nothing" },
    { claim: null, expected: true, label: "null — still not an assertion of falsity" },
    { claim: "", expected: true, label: "empty string" },
    { claim: 0, expected: true, label: "a number the claim should never be" },
    { claim: {}, expected: true, label: "a malformed object" },
  ])("$label → $expected", ({ claim, expected }) => {
    expect(resolveEmailVerifiedFromRawClaim(claim)).toBe(expected);
  });

  /**
   * The asymmetry IS the design, so it gets its own assertion rather than living implicitly in the
   * table above: only an explicit denial denies. Collapsing these two cases together is exactly the
   * bug — `email_verified ?? false` upstream — that reading the raw claim exists to route around.
   */
  test("distinguishes an asserted false from a claim that was never sent", () => {
    expect(resolveEmailVerifiedFromRawClaim(false)).toBe(false);
    expect(resolveEmailVerifiedFromRawClaim(undefined)).toBe(true);
  });
});

describe("resolveSsoEmailVerifiedForCreate", () => {
  // `attested` (Better Auth computed it) and `raw-claim` (our mapper computed it) both arrive as
  // `user.emailVerified`, so both honour it strictly.
  test.each(["google", "github", "azuread", "openid"] as const)(
    "%s honours the claim that reached the hook",
    (provider) => {
      expect(resolveSsoEmailVerifiedForCreate(provider, true)).toBe(true);
      expect(resolveSsoEmailVerifiedForCreate(provider, false)).toBe(false);
      // Strictly `=== true`: an absent value is not attestation. The raw-claim mappers have already
      // turned a genuinely absent claim into `true` before this point, so nothing legitimate is lost.
      expect(resolveSsoEmailVerifiedForCreate(provider, undefined)).toBe(false);
    }
  );

  // SAML can carry no claim on any path, so there is nothing to honour and nothing to lose.
  test.each([true, false, undefined])("saml is verified regardless of the value %s", (value) => {
    expect(resolveSsoEmailVerifiedForCreate("saml", value)).toBe(true);
  });
});

describe("SSO_EMAIL_VERIFICATION_TRUST", () => {
  /**
   * Pins the table itself, because every provider's behaviour above is read off it and a silent edit
   * here would move a provider between policies with no other test failing. The type makes the table
   * exhaustive; this makes it deliberate.
   */
  test("names a trust mode for every SSO provider", () => {
    expect(SSO_EMAIL_VERIFICATION_TRUST).toEqual({
      google: "attested",
      github: "attested",
      azuread: "raw-claim",
      openid: "raw-claim",
      saml: "never-attests",
    });
  });
});
