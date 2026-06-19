import { describe, expect, test, vi } from "vitest";
import { getSsoProviderFromContext, ssoDatabaseHooks } from "./better-auth-hooks";

describe("getSsoProviderFromContext", () => {
  test("reads the provider from a generic-OAuth callback's params", () => {
    expect(
      getSsoProviderFromContext({ path: "/oauth2/callback/:providerId", params: { providerId: "openid" } })
    ).toBe("openid");
  });

  test("reads the provider from a built-in social callback's params", () => {
    expect(getSsoProviderFromContext({ path: "/callback/:id", params: { id: "google" } })).toBe("google");
  });

  test("falls back to parsing a resolved callback path", () => {
    expect(getSsoProviderFromContext({ path: "/oauth2/callback/azuread", params: {} })).toBe("azuread");
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

  test("marks SSO sign-ups verified and denormalizes identityProvider", async () => {
    const result = await before(
      { id: "u1", email: "a@b.com", emailVerified: false } as never,
      {
        path: "/oauth2/callback/:providerId",
        params: { providerId: "openid" },
      } as never
    );
    expect(result).toEqual({ data: { emailVerified: true, identityProvider: "openid" } });
  });

  test("leaves email/password sign-ups untouched", async () => {
    const result = await before({ id: "u1", email: "a@b.com" } as never, { path: "/sign-up/email" } as never);
    expect(result).toBeUndefined();
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
