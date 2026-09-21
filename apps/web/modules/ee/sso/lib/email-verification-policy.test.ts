import { afterEach, describe, expect, test, vi } from "vitest";
import {
  SSO_EMAIL_VERIFICATION_TRUST,
  resolveEmailVerifiedFromRawClaim,
  resolveSsoEmailVerifiedForCreate,
} from "./email-verification-policy";

// The mappers capture the SSO identity into request-scoped storage; stub it so they run standalone.
vi.mock("./sso-request-context", () => ({ captureSsoIdentity: vi.fn() }));

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
    // A denial arrives in whatever spelling the provider's backend produces, and every one of these
    // used to fail OPEN — the same bug this module exists to close, one serialization removed.
    { claim: "False", expected: false, label: "a Python-style capitalized string" },
    { claim: "FALSE", expected: false, label: "an upper-cased string" },
    { claim: " false ", expected: false, label: "a padded string" },
    { claim: 0, expected: false, label: "the numeric false some IdPs send" },
    { claim: "0", expected: false, label: "that numeric false as a string" },
    { claim: true, expected: true, label: "the IdP attested the address" },
    { claim: "true", expected: true, label: "attestation serialized as a string" },
    { claim: 1, expected: true, label: "the numeric true" },
    { claim: undefined, expected: true, label: "absent — the IdP asserted nothing" },
    { claim: null, expected: true, label: "null — still not an assertion of falsity" },
    { claim: "", expected: true, label: "empty string" },
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

/**
 * The table only earns its keep if the providers actually behave the way it says. `resolveSsoEmailVerified
 * ForCreate` branches on `never-attests` alone, and the `raw-claim` behaviour lives in each provider's
 * own `mapProfileToUser` — so without a check tying the two together, an entry could read `raw-claim`
 * while its mapper quietly ignored the claim, and nothing would fail. These assert the tie.
 */
describe("SSO_EMAIL_VERIFICATION_TRUST is consistent with what the providers actually do", () => {
  const loadGenericMappers = async () => {
    vi.resetModules();
    vi.doMock("@/lib/constants", async () => {
      const actual = await vi.importActual<Record<string, unknown>>("@/lib/constants");
      return {
        ...actual,
        ENTERPRISE_LICENSE_KEY: "lic",
        AZURE_OAUTH_ENABLED: true,
        AZUREAD_CLIENT_ID: "az",
        AZUREAD_CLIENT_SECRET: "az-secret",
        AZUREAD_TENANT_ID: "00000000-1111-2222-3333-444444444444", // concrete → discovery branch
        OIDC_OAUTH_ENABLED: true,
        OIDC_CLIENT_ID: "oidc",
        OIDC_CLIENT_SECRET: "oidc-secret",
        OIDC_ISSUER: "https://idp.test",
        SAML_OAUTH_ENABLED: true,
        GITHUB_OAUTH_ENABLED: false,
        GOOGLE_OAUTH_ENABLED: false,
      };
    });
    const { ssoGenericOAuthConfig } = await import("./better-auth-providers");
    return ssoGenericOAuthConfig;
  };

  afterEach(() => {
    vi.doUnmock("@/lib/constants");
  });

  test("every raw-claim provider's mapper actually honours a denial", async () => {
    const configs = await loadGenericMappers();
    const rawClaimProviders = Object.entries(SSO_EMAIL_VERIFICATION_TRUST)
      .filter(([, trust]) => trust === "raw-claim")
      .map(([provider]) => provider);
    expect(rawClaimProviders.length).toBeGreaterThan(0);

    for (const provider of rawClaimProviders) {
      const config = configs.find((c) => c.providerId === provider);
      if (!config?.mapProfileToUser) throw new Error(`${provider} is raw-claim but registers no mapper`);

      const mapped = (config.mapProfileToUser as (p: Record<string, unknown>) => { emailVerified?: boolean })(
        { email: "a@b.test", sub: "s", email_verified: false }
      );
      expect(mapped.emailVerified, `${provider} must honour an asserted false`).toBe(false);
    }
  });

  test("no never-attests provider smuggles a claim into the mapped user", async () => {
    const configs = await loadGenericMappers();
    const neverAttests = Object.entries(SSO_EMAIL_VERIFICATION_TRUST)
      .filter(([, trust]) => trust === "never-attests")
      .map(([provider]) => provider);

    for (const provider of neverAttests) {
      const config = configs.find((c) => c.providerId === provider);
      if (!config?.mapProfileToUser) continue; // not a generic provider

      const mapped = (config.mapProfileToUser as (p: Record<string, unknown>) => Record<string, unknown>)({
        email: "a@b.test",
        id: "s",
        email_verified: false,
      });
      expect(mapped, `${provider} must leave the decision to the hook`).not.toHaveProperty("emailVerified");
    }
  });
});
