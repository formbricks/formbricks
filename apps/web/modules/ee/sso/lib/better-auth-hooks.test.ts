import { getOAuthState } from "better-auth/api";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE } from "@formbricks/types/errors";
import { identifyPostHogPerson } from "@/lib/posthog";
import { findMatchingLocale } from "@/lib/utils/locale";
import { enforceCredentialSignupBackstop } from "@/modules/auth/lib/credential-signup-backstop";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { getIsSamlSsoEnabled, getIsSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  blockedSignupDomainRedirectAfter,
  getSsoProviderFromContext,
  ssoDatabaseHooks,
  ssoLicenseGateBefore,
  ssoProfileSyncUpdateBefore,
  ssoRecoveryAfter,
} from "./better-auth-hooks";
import { gateSsoProvisioning, provisionSsoUserMemberships } from "./sso-provisioning";
import { startSsoRecovery } from "./sso-recovery";
import {
  captureSsoIdentity,
  getSsoProvisioningDecision,
  getSsoSignupRejectReason,
  runWithSsoRequestContext,
  setSsoProvisioningDecision,
  setSsoSignupRejectReason,
} from "./sso-request-context";

// Spread the REAL module: only `getOAuthState` and the middleware wrapper need stubbing. A hand-rolled
// `APIError` class cannot stand in here — Better Auth identifies one by `instanceof` or `name ===
// "APIError"`, and a local subclass of Error reports `name === "Error"`, so every `isAPIError` branch
// the reject now depends on would take the wrong path while these tests still passed.
vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth/api")>()),
  getOAuthState: vi.fn(),
  // Passthrough so the wrapped hook is testable directly as its inner function.
  createAuthMiddleware: (fn: unknown) => fn,
}));
vi.mock("@formbricks/database", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
// The unverified-sign-up signal (ENG-2589) is asserted through both of its channels.
const { loggerWarn, loggerError, loggerWithContext } = vi.hoisted(() => {
  const warn = vi.fn();
  return { loggerWarn: warn, loggerError: vi.fn(), loggerWithContext: vi.fn(() => ({ warn })) };
});
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: loggerWithContext, warn: loggerWarn, error: loggerError },
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEventBackground: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ identifyPostHogPerson: vi.fn() }));
vi.mock("@/lib/utils/locale", () => ({ findMatchingLocale: vi.fn() }));
vi.mock("./sso-provisioning", () => ({
  gateSsoProvisioning: vi.fn(),
  provisionSsoUserMemberships: vi.fn(),
}));
vi.mock("./sso-recovery", () => ({ startSsoRecovery: vi.fn() }));
// The credential policy is its own module now (credential-signup-backstop.test.ts covers it); here it
// is mocked so the hook's routing to it can be asserted without re-testing the policy itself.
vi.mock("@/modules/auth/lib/credential-signup-backstop", () => ({
  enforceCredentialSignupBackstop: vi.fn(),
}));

vi.mock("@/lib/constants", () => ({ WEBAPP_URL: "http://localhost:3000" }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsSsoEnabled: vi.fn(),
  getIsSamlSsoEnabled: vi.fn(),
}));

// Better Auth's INTERNAL endpoint path, which 1.7 serves at `/callback/:id`. Not the public SSO callback
// URL — that stays `/api/auth/oauth2/callback/{providerId}`, pinned (ENG-2343) and mapped onto this one.
const callbackCtx = { path: "/callback/:providerId", params: { providerId: "openid" } };
const provisionDecision = {
  action: "provision" as const,
  organizationId: "org-1",
  assignToDefaultTeam: false,
  signupSource: "direct" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findMatchingLocale).mockResolvedValue("en-US");
  vi.mocked(getOAuthState).mockResolvedValue({ callbackURL: "/" } as never);
  vi.mocked(gateSsoProvisioning).mockResolvedValue(provisionDecision);
  vi.mocked(getIsSsoEnabled).mockResolvedValue(true);
  vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
  vi.mocked(enforceCredentialSignupBackstop).mockResolvedValue(undefined);
  // The real helper is async and returns a promise the caller attaches a `.catch` to; a bare `vi.fn()`
  // would return undefined and make that call throw for reasons the code under test never causes.
  vi.mocked(queueAuditEventBackground).mockResolvedValue(undefined);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: "u1",
    email: "a@b.com",
    locale: "en-US",
  } as never);
  vi.mocked(startSsoRecovery).mockResolvedValue("/auth/verification-requested?x=1");
});

describe("getSsoProviderFromContext", () => {
  test("reads the provider from a generic-OAuth callback's params", () => {
    expect(
      getSsoProviderFromContext({ path: "/callback/:providerId", params: { providerId: "openid" } })
    ).toBe("openid");
  });

  test("reads the provider from a built-in social callback's params", () => {
    expect(getSsoProviderFromContext({ path: "/callback/:id", params: { id: "google" } })).toBe("google");
  });

  test("falls back to parsing a resolved callback path", () => {
    expect(getSsoProviderFromContext({ path: "/callback/azuread", params: {} })).toBe("azuread");
  });

  test.each([{ path: "/sign-up/email" }, { path: "/sign-in/email" }, {}, null, undefined])(
    "returns null for non-callback context %j",
    (ctx) => {
      expect(getSsoProviderFromContext(ctx as never)).toBeNull();
    }
  );
});

describe("ssoDatabaseHooks.user.create.before", () => {
  const before = ssoDatabaseHooks.user!.create!.before!;

  /**
   * ENG-2537. The documented way to reject here is `return false`, and it is what shipped — but Better
   * Auth then resolves `createUser` to `null` and reads `createdUser.id` off it one line later, which
   * 500s every rejected SSO sign-up. It must throw an APIError carrying a `code` instead: that is the
   * shape the OAuth callback catches and converts into a redirect.
   */
  test("throws an APIError carrying the reason code when the provisioning gate rejects", async () => {
    vi.mocked(gateSsoProvisioning).mockResolvedValue({ action: "reject", reason: "missing_callback_url" });

    await expect(
      runWithSsoRequestContext(() => before({ id: "u1", email: "a@b.com" } as never, callbackCtx as never))
      // The `code` is load-bearing: `callback.mjs` only redirects for an APIError that carries one, and
      // rethrows otherwise — which is the 500 this replaces.
    ).rejects.toMatchObject({ status: "FORBIDDEN", body: { code: "missing_callback_url" } });
  });

  test("does not stash a provisioning decision for a rejected sign-up", async () => {
    vi.mocked(gateSsoProvisioning).mockResolvedValue({ action: "reject", reason: "missing_callback_url" });
    let stashed: ReturnType<typeof getSsoProvisioningDecision>;

    await runWithSsoRequestContext(async () => {
      await before({ id: "u1", email: "a@b.com" } as never, callbackCtx as never).catch(() => undefined);
      stashed = getSsoProvisioningDecision();
    });

    expect(stashed).toBeUndefined();
  });

  test("stashes the reject reason so the after-hook can redirect (personal email domain)", async () => {
    vi.mocked(gateSsoProvisioning).mockResolvedValue({
      action: "reject",
      reason: SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE,
    });
    let reason: string | undefined;
    await runWithSsoRequestContext(async () => {
      // The throw is the reject; the stashed reason is what the after-hook reads to rewrite the
      // redirect Better Auth produces from it.
      await before({ id: "u1", email: "spammer@gmail.com" } as never, callbackCtx as never).catch(
        () => undefined
      );
      reason = getSsoSignupRejectReason();
    });
    expect(reason).toBe(SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE);
  });

  test("fails loud when the request context is missing (route not wrapped in runWithSsoRequestContext)", async () => {
    // Without the wrapper a provision decision can't be stashed; fail rather than silently create a
    // user with no organization membership.
    await expect(before({ id: "u1", email: "a@b.com" } as never, callbackCtx as never)).rejects.toThrow(
      "SSO request context is missing"
    );
  });

  test("on provision: verifies email, denormalizes provider, sets locale + name fallback, and stashes the decision", async () => {
    let stashed: ReturnType<typeof getSsoProvisioningDecision>;
    const result = await runWithSsoRequestContext(async () => {
      // `emailVerified: true` is what the openid mapper resolves for an IdP that omits the claim — the
      // common path — so this stays a test about the other four enrichment fields.
      const r = await before(
        { id: "u1", email: "john.doe@example.com", emailVerified: true } as never,
        callbackCtx as never
      );
      stashed = getSsoProvisioningDecision();
      return r;
    });
    expect(result).toEqual({
      data: { emailVerified: true, identityProvider: "openid", locale: "en-US", name: "john doe" },
    });
    // image is present-as-undefined so Better Auth's transformInput drops it (no User.image column).
    expect(result).toHaveProperty("data.image", undefined);
    expect(stashed).toEqual(provisionDecision);
    expect(gateSsoProvisioning).toHaveBeenCalledWith({ email: "john.doe@example.com", callbackUrl: "/" });
  });

  test("normalizes a clean provider-supplied name (unchanged, no fallback) when present", async () => {
    const result = await runWithSsoRequestContext(() =>
      before(
        { id: "u1", email: "a@b.com", name: "Ada Lovelace", emailVerified: true } as never,
        callbackCtx as never
      )
    );
    expect(result).toEqual({
      data: { emailVerified: true, identityProvider: "openid", locale: "en-US", name: "Ada Lovelace" },
    });
  });

  // ENG-1743: an IdP display name with common punctuation must never fail the sign-in. The provider
  // name is normalized to a ZUserName-valid form (allowlisted punctuation preserved, the rest collapsed
  // to a single space), so no `ValidationError: Invalid name format` is thrown from the SSO create path.
  test.each([
    { name: "J. Smith", expected: "J. Smith" }, // period preserved
    { name: "Smith & Co", expected: "Smith & Co" }, // ampersand preserved
    { name: "Ada  O'Neil", expected: "Ada O'Neil" }, // apostrophe kept, double space collapsed
    { name: "A/B Corp", expected: "A B Corp" }, // slash (not allowlisted) collapsed to space
    { name: "José 🎉 Núñez", expected: "José Núñez" }, // emoji stripped, accented letters kept
  ])("normalizes a punctuated provider name '$name' → '$expected'", async ({ name, expected }) => {
    const result = await runWithSsoRequestContext(() =>
      before({ id: "u1", email: "a@b.com", name } as never, callbackCtx as never)
    );
    expect(result).toMatchObject({ data: { name: expected } });
  });

  test("falls back to the email local-part when the provider name normalizes to empty", async () => {
    const result = await runWithSsoRequestContext(() =>
      before({ id: "u1", email: "jane.doe@example.com", name: "🎉🎉" } as never, callbackCtx as never)
    );
    expect(result).toMatchObject({ data: { name: "jane doe" } });
  });

  // ENG-1743 edge: if BOTH the provider name and the email local-part normalize to empty (a degenerate
  // service/machine account), fall back to a constant so the stored name is a valid non-empty
  // ZUserName — otherwise "" would pass Better Auth's create but throw on the user's first profile save.
  test("falls back to a constant when the provider name and email local-part both normalize to empty", async () => {
    const result = await runWithSsoRequestContext(() =>
      before({ id: "u1", email: "🎉@example.com", name: "🎉🎉" } as never, callbackCtx as never)
    );
    expect(result).toMatchObject({ data: { name: "User" } });
  });

  // ENG-2589: Better Auth computes the IdP's own `emailVerified` answer BEFORE this hook runs —
  // google reads `email_verified` from the id_token, github from /user/emails — and hands it to the
  // hook as `user.emailVerified`; whatever the hook returns is shallow-merged over it. Overwriting
  // with `true` mints a verified account for an address the IdP itself calls unproven (account
  // squatting: `reclaimUnverifiedLocalAuthIfNeeded` skips verified users, and an org invite to that
  // address lands on the squatter's account).
  describe("emailVerified follows the IdP's claim where it is a real signal (ENG-2589)", () => {
    const socialCtx = (id: string) => ({ path: "/callback/:id", params: { id } });

    test.each(["google", "github"])("%s: an IdP-unverified email is not marked verified", async (id) => {
      const result = await runWithSsoRequestContext(() =>
        before({ id: "u1", email: "a@b.com", emailVerified: false } as never, socialCtx(id) as never)
      );
      expect(result).toMatchObject({ data: { emailVerified: false } });
    });

    test.each(["google", "github"])("%s: an IdP-verified email stays verified", async (id) => {
      const result = await runWithSsoRequestContext(() =>
        before({ id: "u1", email: "a@b.com", emailVerified: true } as never, socialCtx(id) as never)
      );
      expect(result).toMatchObject({ data: { emailVerified: true } });
    });

    // The generic providers are `raw-claim`: their mapProfileToUser has already resolved the raw
    // `email_verified` (absent → true, asserted false → false) and that value reaches the hook as
    // `user.emailVerified`, so the hook passes it through rather than deciding again. Asserting the
    // pass-through here is what stops a future edit re-introducing a blanket `true` that would
    // silently discard the mapper's answer — the claim-reading itself is covered in
    // better-auth-providers.test.ts and end to end in better-auth-oidc-email-verified.test.ts.
    test.each(["openid", "azuread"])("%s: passes the mapper-resolved claim through", async (id) => {
      const genericCtx = { path: "/callback/:providerId", params: { providerId: id } };
      const denied = await runWithSsoRequestContext(() =>
        before({ id: "u1", email: "a@b.com", emailVerified: false } as never, genericCtx as never)
      );
      expect(denied).toMatchObject({ data: { emailVerified: false } });

      const attested = await runWithSsoRequestContext(() =>
        before({ id: "u1", email: "a@b.com", emailVerified: true } as never, genericCtx as never)
      );
      expect(attested).toMatchObject({ data: { emailVerified: true } });
    });

    // SAML is `never-attests`: BoxyHQ carries no `email_verified` on any path, so there is no claim to
    // honour and the row is verified as it always has been — whatever value happens to arrive.
    test("saml: stays verified, because no claim can exist", async () => {
      const result = await runWithSsoRequestContext(() =>
        before(
          { id: "u1", email: "a@b.com", emailVerified: false } as never,
          { path: "/callback/:providerId", params: { providerId: "saml" } } as never
        )
      );
      expect(result).toMatchObject({ data: { emailVerified: true } });
    });
  });

  /**
   * The credential branch now delegates to `enforceCredentialSignupBackstop`
   * (modules/auth/lib/credential-signup-backstop.ts), where its own suite covers the domain block and
   * the ENG-2293 closed-instance policy in detail. What matters HERE is the routing: a non-SSO context
   * must reach that policy rather than the SSO gate, and its answer must be passed through unaltered —
   * Better Auth reads the return value literally, so a hook that swallowed a `false` would silently
   * re-open every path the backstop closes.
   */
  test.each([
    { verdict: false as const, label: "a block" },
    { verdict: undefined, label: "an allow" },
  ])("routes a credential sign-up to the backstop and passes $label through", async ({ verdict }) => {
    vi.mocked(enforceCredentialSignupBackstop).mockResolvedValue(verdict);

    const result = await before({ id: "u1", email: "a@b.com" } as never, { path: "/sign-up/email" } as never);

    expect(result).toBe(verdict);
    expect(enforceCredentialSignupBackstop).toHaveBeenCalledWith("a@b.com");
    expect(gateSsoProvisioning).not.toHaveBeenCalled();
  });

  test("propagates a backstop rejection instead of creating the user", async () => {
    vi.mocked(enforceCredentialSignupBackstop).mockRejectedValue(new Error("signup disabled"));

    await expect(
      before({ id: "u1", email: "a@b.com" } as never, { path: "/sign-up/email" } as never)
    ).rejects.toThrow("signup disabled");
  });
});

describe("ssoDatabaseHooks.user.create.after", () => {
  const after = ssoDatabaseHooks.user!.create!.after!;
  const before = ssoDatabaseHooks.user!.create!.before!;

  test("provisions memberships from the stashed decision", async () => {
    await runWithSsoRequestContext(async () => {
      setSsoProvisioningDecision(provisionDecision);
      await after({ id: "u1", email: "a@b.com" } as never, callbackCtx as never);
    });
    expect(provisionSsoUserMemberships).toHaveBeenCalledWith({
      userId: "u1",
      email: "a@b.com",
      provider: "openid",
      organizationId: "org-1",
      assignToDefaultTeam: false,
      signupSource: "direct",
      attributionProperties: {},
    });
    expect(identifyPostHogPerson).toHaveBeenCalledWith("u1", { email: "a@b.com", name: undefined });
  });

  test("does nothing when no decision is stashed (e.g. non-SSO sign-up)", async () => {
    await runWithSsoRequestContext(() =>
      after({ id: "u1", email: "a@b.com" } as never, callbackCtx as never)
    );
    expect(provisionSsoUserMemberships).not.toHaveBeenCalled();
  });

  /**
   * ENG-2589. An account created for an address the IdP would not vouch for is the state this fix
   * allows to exist, so it has to be visible: an audit event for the security trail, and a `warn` log
   * for the self-hosters who have no audit log (it is enterprise-gated and off by default).
   */
  describe("observability for an IdP-unverified sign-up", () => {
    const runAfter = (emailVerified: boolean) =>
      runWithSsoRequestContext(async () => {
        setSsoProvisioningDecision(provisionDecision);
        await after({ id: "u1", email: "a@b.com", emailVerified } as never, callbackCtx as never);
      });

    test("emits a warn log and an audit event naming the provider", async () => {
      await runAfter(false);

      // `userId` is on the log line too: the audit event is enterprise-gated, so for a self-hoster this
      // is the only channel, and without an identifier it names no account to go and look at.
      expect(loggerWithContext).toHaveBeenCalledWith({
        source: "sso-signup",
        ssoProvider: "openid",
        userId: "u1",
        emailVerified: false,
      });
      expect(loggerWarn).toHaveBeenCalledTimes(1);
      expect(queueAuditEventBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "updated",
          targetType: "user",
          userId: "u1",
          targetId: "u1",
          organizationId: "org-1",
          status: "success",
          newObject: { ssoUnverifiedSignupMarker: true, provider: "openid", emailVerified: false },
        })
      );
    });

    // A sign-up can provision no organization at all, and the audit schema takes no null there.
    test("falls back to the unknown-organization marker when none was provisioned", async () => {
      await runWithSsoRequestContext(async () => {
        setSsoProvisioningDecision({ ...provisionDecision, organizationId: null });
        await after({ id: "u1", email: "a@b.com", emailVerified: false } as never, callbackCtx as never);
      });

      expect(queueAuditEventBackground).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: "unknown" })
      );
    });

    // The verified case is the overwhelming majority; emitting for it would bury the signal.
    test("says nothing for a verified sign-up", async () => {
      await runAfter(true);

      expect(loggerWarn).not.toHaveBeenCalled();
      expect(queueAuditEventBackground).not.toHaveBeenCalled();
    });

    test("provisions the user either way", async () => {
      await runAfter(false);

      expect(provisionSsoUserMemberships).toHaveBeenCalledTimes(1);
    });

    // Observability must never be the reason a sign-up fails: this runs post-commit, so a throw here
    // would surface as a broken callback on an account that already exists.
    test.each([
      {
        label: "throws synchronously",
        impl: () => {
          throw new Error("audit sink unavailable");
        },
      },
      // The call is not awaited, so a rejection has to be caught on the promise or it escapes the
      // try/catch entirely and lands as an unhandled rejection.
      { label: "rejects asynchronously", impl: async () => Promise.reject(new Error("audit sink down")) },
    ])("a failing audit sink that $label does not break the sign-up", async ({ impl }) => {
      vi.mocked(queueAuditEventBackground).mockImplementation(impl as never);

      await expect(runAfter(false)).resolves.not.toThrow();
      expect(provisionSsoUserMemberships).toHaveBeenCalledTimes(1);
    });
  });

  test("before → after carries the decision end-to-end", async () => {
    await runWithSsoRequestContext(async () => {
      await before({ id: "u1", email: "a@b.com" } as never, callbackCtx as never);
      await after({ id: "u1", email: "a@b.com" } as never, callbackCtx as never);
    });
    expect(provisionSsoUserMemberships).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", organizationId: "org-1", provider: "openid" })
    );
  });
});

describe("ssoDatabaseHooks.account.create.after", () => {
  const after = ssoDatabaseHooks.account!.create!.after!;
  const ctxWith = (updateUser: unknown) => ({ context: { internalAdapter: { updateUser } } });

  test("denormalizes provider + accountId onto the user for SSO accounts", async () => {
    const updateUser = vi.fn().mockResolvedValue(undefined);
    await after(
      { userId: "u1", providerId: "azuread", accountId: "sub-123" } as never,
      ctxWith(updateUser) as never
    );
    expect(updateUser).toHaveBeenCalledWith("u1", {
      identityProvider: "azuread",
      identityProviderAccountId: "sub-123",
    });
  });

  test("skips credential (email/password) accounts", async () => {
    const updateUser = vi.fn();
    await after(
      { userId: "u1", providerId: "credential", accountId: "x" } as never,
      ctxWith(updateUser) as never
    );
    expect(updateUser).not.toHaveBeenCalled();
  });
});

describe("ssoLicenseGateBefore", () => {
  const samlCtx = { path: "/callback/:providerId", params: { providerId: "saml" } };

  test("ignores non-callback requests without checking the license", async () => {
    await ssoLicenseGateBefore({ path: "/sign-up/email" } as never);
    expect(getIsSsoEnabled).not.toHaveBeenCalled();
  });

  test("allows an SSO callback when SSO is licensed", async () => {
    await expect(ssoLicenseGateBefore(callbackCtx as never)).resolves.toBeUndefined();
    expect(getIsSsoEnabled).toHaveBeenCalled();
  });

  test("blocks an SSO callback when SSO is not licensed", async () => {
    vi.mocked(getIsSsoEnabled).mockResolvedValue(false);
    await expect(ssoLicenseGateBefore(callbackCtx as never)).rejects.toThrow("SSO is not enabled");
  });

  test("blocks a SAML callback when SAML is not licensed (even if SSO is)", async () => {
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(false);
    await expect(ssoLicenseGateBefore(samlCtx as never)).rejects.toThrow("SAML SSO is not enabled");
  });

  test("allows a SAML callback when both SSO and SAML are licensed", async () => {
    await expect(ssoLicenseGateBefore(samlCtx as never)).resolves.toBeUndefined();
  });
});

describe("ssoRecoveryAfter", () => {
  const collisionLocation = "https://app.test/error?error=account_not_linked";
  const makeCtx = (overrides: Record<string, unknown> = {}) => ({
    path: "/callback/:providerId",
    params: { providerId: "openid" },
    context: { responseHeaders: new Headers({ location: collisionLocation }) },
    redirect: vi.fn((url: string) => new Error(`redirect:${url}`)),
    ...overrides,
  });

  test("starts recovery and redirects on a collision with a captured identity + existing user", async () => {
    const redirect = vi.fn((url: string) => new Error(`redirect:${url}`));
    const ctx = makeCtx({ redirect });
    await runWithSsoRequestContext(async () => {
      captureSsoIdentity({ email: "a@b.com", providerAccountId: "sub-1" });
      await expect(ssoRecoveryAfter(ctx as never)).rejects.toBeDefined(); // throws ctx.redirect(...)
    });
    expect(startSsoRecovery).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openid",
        account: expect.objectContaining({ providerAccountId: "sub-1" }),
      })
    );
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining("/auth/verification-requested"));
  });

  test("ignores callbacks that did not collide", async () => {
    const ctx = makeCtx({ context: { responseHeaders: new Headers({ location: "https://app.test/ok" }) } });
    await runWithSsoRequestContext(async () => {
      captureSsoIdentity({ email: "a@b.com", providerAccountId: "sub-1" });
      await ssoRecoveryAfter(ctx as never);
    });
    expect(startSsoRecovery).not.toHaveBeenCalled();
  });

  test("ignores collisions with no captured identity", async () => {
    const ctx = makeCtx();
    await runWithSsoRequestContext(() => ssoRecoveryAfter(ctx as never));
    expect(startSsoRecovery).not.toHaveBeenCalled();
  });

  test("ignores collisions with no matching existing user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const ctx = makeCtx();
    await runWithSsoRequestContext(async () => {
      captureSsoIdentity({ email: "ghost@b.com", providerAccountId: "sub-1" });
      await ssoRecoveryAfter(ctx as never);
    });
    expect(startSsoRecovery).not.toHaveBeenCalled();
  });

  test("ignores non-SSO callbacks", async () => {
    const ctx = makeCtx({ path: "/sign-up/email", params: {} });
    await ssoRecoveryAfter(ctx as never);
    expect(startSsoRecovery).not.toHaveBeenCalled();
  });

  test("ignores callbacks with no response-redirect headers", async () => {
    const ctx = makeCtx({ context: {} });
    await runWithSsoRequestContext(async () => {
      captureSsoIdentity({ email: "a@b.com", providerAccountId: "sub-1" });
      await ssoRecoveryAfter(ctx as never);
    });
    expect(startSsoRecovery).not.toHaveBeenCalled();
  });

  test("still recovers (empty callbackUrl) when the OAuth state is unavailable", async () => {
    vi.mocked(getOAuthState).mockRejectedValue(new Error("no state"));
    const redirect = vi.fn((url: string) => new Error(`redirect:${url}`));
    const ctx = makeCtx({ redirect });
    await runWithSsoRequestContext(async () => {
      captureSsoIdentity({ email: "a@b.com", providerAccountId: "sub-1" });
      await expect(ssoRecoveryAfter(ctx as never)).rejects.toBeDefined();
    });
    expect(startSsoRecovery).toHaveBeenCalledWith(expect.objectContaining({ callbackUrl: "" }));
    expect(redirect).toHaveBeenCalled();
  });
});

describe("blockedSignupDomainRedirectAfter", () => {
  const makeCtx = (overrides: Record<string, unknown> = {}) => ({
    path: "/callback/:providerId",
    params: { providerId: "openid" },
    context: {
      responseHeaders: new Headers({ location: "https://app.test/auth/login?error=unable_to_create_user" }),
    },
    redirect: vi.fn((url: string) => new Error(`redirect:${url}`)),
    ...overrides,
  });

  test("rewrites the redirect to /auth/signup when a personal-email rejection was stashed", async () => {
    const redirect = vi.fn((url: string) => new Error(`redirect:${url}`));
    const ctx = makeCtx({ redirect });
    await runWithSsoRequestContext(async () => {
      setSsoSignupRejectReason(SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE);
      await expect(blockedSignupDomainRedirectAfter(ctx as never)).rejects.toBeDefined(); // throws ctx.redirect
    });
    expect(redirect).toHaveBeenCalledWith(
      expect.stringContaining(`/auth/signup?error=${SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE}`)
    );
  });

  test("does nothing when no personal-email rejection was stashed", async () => {
    const redirect = vi.fn();
    const ctx = makeCtx({ redirect });
    await runWithSsoRequestContext(() => blockedSignupDomainRedirectAfter(ctx as never));
    expect(redirect).not.toHaveBeenCalled();
  });

  test("does nothing for a different (non-domain) reject reason", async () => {
    const redirect = vi.fn();
    const ctx = makeCtx({ redirect });
    await runWithSsoRequestContext(async () => {
      setSsoSignupRejectReason("missing_callback_url");
      await blockedSignupDomainRedirectAfter(ctx as never);
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  test("does nothing when Better Auth set no redirect location", async () => {
    const redirect = vi.fn();
    const ctx = makeCtx({ redirect, context: {} });
    await runWithSsoRequestContext(async () => {
      setSsoSignupRejectReason(SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE);
      await blockedSignupDomainRedirectAfter(ctx as never);
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("ssoProfileSyncUpdateBefore", () => {
  // The shape Better Auth writes under `overrideUserInfo`: handleOAuthUserInfo destructures the
  // resolved userInfo, so name/image/email/emailVerified are all present on this one update.
  const overrideWrite = {
    name: "Jane Doe-Smith",
    image: "https://graph.microsoft.com/v1.0/me/photo/$value",
    email: "jane@corp.test",
    emailVerified: true,
  };

  test("drops `image`, which has no column on User and would fail the update", async () => {
    const result = await ssoProfileSyncUpdateBefore(overrideWrite, callbackCtx);
    // `undefined` is how a field is removed: on an update the adapter skips every undefined field
    // that has no `onUpdate`. Asserting the key is present and undefined, not merely absent, because
    // the hook's return is shallow-MERGED over the original data — a missing key would keep the URL.
    expect(result?.data).toHaveProperty("image", undefined);
  });

  test("keeps the stored email and its verified flag out of the sync", async () => {
    const result = await ssoProfileSyncUpdateBefore(overrideWrite, callbackCtx);
    expect(result?.data).toHaveProperty("email", undefined);
    expect(result?.data).toHaveProperty("emailVerified", undefined);
  });

  test("syncs the renamed display name", async () => {
    const result = await ssoProfileSyncUpdateBefore(overrideWrite, callbackCtx);
    expect(result?.data.name).toBe("Jane Doe-Smith");
  });

  test("normalizes an IdP name the same way sign-up does (ENG-1743)", async () => {
    const result = await ssoProfileSyncUpdateBefore(
      { ...overrideWrite, name: "Jane  Doe-Smith \u2028<script>" },
      callbackCtx
    );
    expect(result?.data.name).toBe("Jane Doe-Smith script");
  });

  test("leaves the stored name alone when the IdP name normalizes away", async () => {
    const result = await ssoProfileSyncUpdateBefore({ ...overrideWrite, name: "🎉🎉" }, callbackCtx);
    // Unlike sign-up there is already a good name in the row, so no email-local-part fallback.
    expect(result?.data).toHaveProperty("name", undefined);
  });

  test("ignores updates made outside an SSO callback", async () => {
    // e.g. POST /change-email — clamping here would silently break it.
    await expect(
      ssoProfileSyncUpdateBefore(overrideWrite, { path: "/change-email" })
    ).resolves.toBeUndefined();
  });

  test("ignores a same-request update that carries no profile fields", async () => {
    // account.create.after denormalizes identityProvider via updateUser on this very callback.
    await expect(
      ssoProfileSyncUpdateBefore(
        { identityProvider: "azuread", identityProviderAccountId: "sub-1" },
        callbackCtx
      )
    ).resolves.toBeUndefined();
  });

  test("ignores the bare emailVerified flip on the link path", async () => {
    await expect(ssoProfileSyncUpdateBefore({ emailVerified: true }, callbackCtx)).resolves.toBeUndefined();
  });
});

/**
 * ENG-2589 — the framework boundary the unit tests above cannot see. Better Auth derives
 * `emailVerified` from GitHub's /user/emails lookup (`verified ?? false`) before `user.create.before`
 * runs, hands it to the hook in its `user` argument, and `createWithHooks` shallow-merges the hook's
 * return over it. These drive a REAL Better Auth instance through the full sign-in → callback flow —
 * with `fetch` stubbed at the GitHub boundary — and assert the row that is actually persisted, so a
 * change in the provider's signal derivation or in the hook-merge order fails here, not in production.
 *
 * The github registration is deliberately minimal: production's `mapProfileToUser` returns only
 * `{ email }` (better-auth-providers.ts), so Better Auth's own emailVerified survives the profile
 * mapping identically in both shapes.
 */
describe("SSO sign-up persists the IdP's email_verified claim (real Better Auth, ENG-2589)", () => {
  const BASE_URL = "https://app.formbricks.test";

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const signUpThroughGithub = async (verifiedAtIdp: boolean) => {
    const { betterAuth } = await import("better-auth");
    const { memoryAdapter } = await import("better-auth/adapters/memory");
    const db: Record<string, Record<string, unknown>[]> = {
      user: [],
      session: [],
      account: [],
      verification: [],
    };
    const auth = betterAuth({
      baseURL: BASE_URL,
      secret: "eng-2589-email-verified-boundary-secret",
      database: memoryAdapter(db),
      user: {
        // The two fields the account.create.after hook denormalizes (parity with auth.ts).
        additionalFields: {
          identityProvider: { type: "string", required: false, input: false },
          identityProviderAccountId: { type: "string", required: false, input: false },
        },
      },
      socialProviders: { github: { clientId: "gh-id", clientSecret: "gh-secret" } },
      databaseHooks: ssoDatabaseHooks,
    });

    // Leg 1: sign-in issues the authorization URL, the state row, and its signed cookie.
    const signIn = await auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: JSON.stringify({ provider: "github", callbackURL: "/" }),
      })
    );
    expect(signIn.status).toBe(200);
    const { url } = (await signIn.json()) as { url: string };
    const state = new URL(url).searchParams.get("state") ?? "";
    expect(state).not.toBe("");
    const cookie = (signIn.headers.getSetCookie?.() ?? []).map((v) => v.split(";")[0]).join("; ");

    // Leg 2: the callback, with GitHub's token + profile + emails endpoints stubbed. The /user/emails
    // `verified` flag is the IdP's actual attestation — the value under test.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const requested = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (requested.startsWith("https://github.com/login/oauth/access_token")) {
          return Response.json({ access_token: "gh-token", token_type: "bearer" });
        }
        if (requested.startsWith("https://api.github.com/user/emails")) {
          return Response.json([{ email: "squatter@corp.test", primary: true, verified: verifiedAtIdp }]);
        }
        if (requested.startsWith("https://api.github.com/user")) {
          return Response.json({
            id: 4242,
            login: "squatter",
            name: "Squatter",
            email: "squatter@corp.test",
          });
        }
        throw new Error(`unexpected outbound fetch: ${requested}`);
      })
    );

    const callback = await runWithSsoRequestContext(() =>
      auth.handler(
        new Request(`${BASE_URL}/api/auth/callback/github?code=gh-code&state=${state}`, {
          headers: { cookie },
        })
      )
    );

    // Anchor the flow itself: a rejected callback would leave db.user empty and a bare
    // `toMatchObject` on undefined would blame the wrong thing.
    expect(callback.status).toBeGreaterThanOrEqual(300);
    return { db, callback };
  };

  /** The sign-up cases expect exactly one row; a reject case asserts on `db` directly. */
  const signUpUserThroughGithub = async (verifiedAtIdp: boolean) => {
    const { db } = await signUpThroughGithub(verifiedAtIdp);
    expect(db.user).toHaveLength(1);
    return db.user[0];
  };

  test("github reporting the address as unverified must not mint a verified account", async () => {
    const user = await signUpUserThroughGithub(false);
    expect(user).toMatchObject({ email: "squatter@corp.test", emailVerified: false });
  });

  test("github reporting the address as verified keeps it verified", async () => {
    const user = await signUpUserThroughGithub(true);
    expect(user).toMatchObject({ email: "squatter@corp.test", emailVerified: true });
  });

  /**
   * ENG-2537, through the real framework rather than against the hook's return value. `return false`
   * makes Better Auth resolve `createUser` to `null` and dereference it, and the resulting TypeError is
   * caught and logged — which is what our own logger forwards to Sentry. Only a run against the real
   * `createWithHooks` and `link-account` can tell that apart from a clean rejection, so this is the case
   * that actually proves the fix: revert the throw to `return false` and the log assertion goes red.
   */
  test("a gated reject redirects cleanly and reports no internal fault", async () => {
    vi.mocked(gateSsoProvisioning).mockResolvedValue({
      action: "reject",
      reason: SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE,
    });

    const { db, callback } = await signUpThroughGithub(true);

    // Nothing was created: the throw aborts Better Auth's user+account transaction.
    expect(db.user).toHaveLength(0);
    expect(db.account).toHaveLength(0);
    // The discriminating assertion. Returning `false` makes Better Auth fail the creation generically —
    // it dereferences null, catches its own TypeError, and redirects with `error=unable_to_create_user`,
    // logging the fault our own logger forwards to Sentry. An APIError carrying a `code` is recognised
    // instead, so the redirect names OUR reason and nothing is reported as a fault.
    const location = callback.headers.get("location") ?? "";
    expect(location).toContain(`error=${SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE}`);
    expect(location).not.toContain("unable_to_create_user");
  });
});
