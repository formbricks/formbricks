import { decodeJwt } from "jose";
import { beforeAll, describe, expect, test } from "vitest";
import { createUser, grant, registerClient, signIn } from "@/integration/oauth-flow";
import { resetDb } from "@/integration/reset-db";

/**
 * ENG-7314 against the real provider: the access token is a JWT the client can read, so `email` and
 * `name` must follow the OIDC scopes the user approved, not ride along on every token.
 */
const EMAIL = "claims-user@example.com";
const PASSWORD = "Passw0rd!Passw0rd";

const claimsFor = async (cookie: string, scope: string) => {
  const clientId = await registerClient(`claims-${scope.replaceAll(/\W/g, "-")}`);
  const tokens = await grant(cookie, clientId, scope);
  return decodeJwt(tokens.access_token);
};

describe("access token identity claims (ENG-7314)", () => {
  let cookie: string;

  beforeAll(async () => {
    await resetDb();
    await createUser(EMAIL, PASSWORD, "Claims User");
    cookie = (await signIn(EMAIL, PASSWORD)).cookie;
  });

  test("a client granted only surveys:read learns neither email nor name", async () => {
    const claims = await claimsFor(cookie, "surveys:read");

    expect(claims.scope).toBe("surveys:read");
    expect(claims).not.toHaveProperty("email");
    expect(claims).not.toHaveProperty("name");
  });

  test("email and name appear only with the email and profile scopes", async () => {
    const withBoth = await claimsFor(cookie, "openid profile email surveys:read");
    expect(withBoth).toMatchObject({ email: EMAIL, name: "Claims User" });

    const emailOnly = await claimsFor(cookie, "openid email surveys:read");
    expect(emailOnly).toMatchObject({ email: EMAIL });
    expect(emailOnly).not.toHaveProperty("name");
  });
});
