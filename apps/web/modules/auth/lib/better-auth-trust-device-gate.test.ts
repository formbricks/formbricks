import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthMiddleware } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import { describe, expect, test } from "vitest";
import { trustDeviceBeforeHandler } from "./better-auth-trust-device-gate";

const EMAIL = "user@example.com";
const PASSWORD = "correct-horse-battery-1";

const emptyDb = () => ({ user: [], session: [], account: [], verification: [], twoFactor: [] });

const makeAuth = (withGate: boolean, db: Record<string, unknown[]> = emptyDb()) =>
  betterAuth({
    baseURL: "http://localhost:3000",
    secret: "x".repeat(40),
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true },
    plugins: [twoFactor({ skipVerificationOnEnable: true })],
    ...(withGate
      ? {
          hooks: {
            before: createAuthMiddleware(async (ctx) => {
              const patch = trustDeviceBeforeHandler(ctx);
              if (patch) return patch;
            }),
          },
        }
      : {}),
  });

const cookieHeader = (headers: Headers) =>
  headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => !c.endsWith("="))
    .join("; ");

/** Sign up, enrol 2FA, sign out; returns the TOTP secret. */
const setup = async (auth: ReturnType<typeof makeAuth>) => {
  const signUp = await auth.api.signUpEmail({
    body: { email: EMAIL, password: PASSWORD, name: "U" },
    returnHeaders: true,
  });
  const headers = new Headers({ cookie: cookieHeader(signUp.headers) });
  const enabled = await auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers });
  if (!("totpURI" in enabled)) throw new Error("expected TOTP enrolment");
  const encoded = new URL(enabled.totpURI).searchParams.get("secret") as string;
  return new TextDecoder().decode(base32.decode(encoded));
};

const totp = (secret: string) => createOTP(secret, { digits: 6, period: 30 }).totp();

/** Password sign-in, then second factor with trustDevice; returns the trust cookie jar (or the error). */
const signInAndVerify = async (auth: ReturnType<typeof makeAuth>, secret: string, trustDevice: boolean) => {
  const first = await auth.api.signInEmail({
    body: { email: EMAIL, password: PASSWORD },
    returnHeaders: true,
  });
  const challenge = new Headers({ cookie: cookieHeader(first.headers) });
  const code = await totp(secret);
  return auth.api.verifyTOTP({
    body: { code, trustDevice },
    headers: challenge,
    returnHeaders: true,
  });
};

const signInWithCookie = async (auth: ReturnType<typeof makeAuth>, cookie: string) =>
  auth.api.signInEmail({
    body: { email: EMAIL, password: PASSWORD },
    headers: new Headers({ cookie }),
    returnHeaders: true,
  });

describe("trust-device gate (SEC-17) against a real Better Auth instance", () => {
  test("baseline: without the gate, trustDevice skips 2FA on the next sign-in", async () => {
    const auth = makeAuth(false);
    const secret = await setup(auth);
    const verified = await signInAndVerify(auth, secret, true);
    const trustCookie = verified.headers.getSetCookie().find((c) => c.includes("trust_device"));
    expect(trustCookie).toBeDefined();

    const again = await signInWithCookie(auth, cookieHeader(verified.headers));
    expect((again.response as { twoFactorRedirect?: boolean }).twoFactorRedirect).toBeUndefined();
  });

  test("with the gate, trustDevice on a verify call is refused", async () => {
    const auth = makeAuth(true);
    const secret = await setup(auth);
    await expect(signInAndVerify(auth, secret, true)).rejects.toMatchObject({ statusCode: 400 });
  });

  test("with the gate, a verify call without trustDevice still signs in and sets no trust cookie", async () => {
    const auth = makeAuth(true);
    const secret = await setup(auth);
    const verified = await signInAndVerify(auth, secret, false);
    expect(verified.headers.getSetCookie().some((c) => c.includes("trust_device"))).toBe(false);
  });

  test("with the gate, an already-issued trust cookie no longer skips the challenge", async () => {
    const db = emptyDb();
    const issuer = makeAuth(false, db);
    const secret = await setup(issuer);
    const verified = await signInAndVerify(issuer, secret, true);
    const jar = cookieHeader(verified.headers);

    // Same secret and store: only the gate differs.
    const again = await signInWithCookie(makeAuth(true, db), jar);
    expect((again.response as { twoFactorRedirect?: boolean }).twoFactorRedirect).toBe(true);
  });

  test("over the HTTP router (auth.handler), an already-issued trust cookie no longer skips the challenge", async () => {
    const db = emptyDb();
    const issuer = makeAuth(false, db);
    const secret = await setup(issuer);
    const jar = cookieHeader((await signInAndVerify(issuer, secret, true)).headers);

    const request = (auth: ReturnType<typeof makeAuth>, cookie = jar) =>
      auth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/email", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://localhost:3000", cookie },
          body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
        })
      );

    // The trusted sign-in consumes the stored trust record and returns a replacement cookie; the gate must
    // refuse that live cookie too, not merely one whose server record is already spent.
    const baseline = await request(makeAuth(false, db));
    const baselineBody = (await baseline.json()) as { twoFactorRedirect?: boolean };
    expect(baselineBody.twoFactorRedirect).toBeUndefined();
    const liveJar = cookieHeader(baseline.headers);
    expect(liveJar).toContain("trust_device");

    const gatedBody = (await (await request(makeAuth(true, db), liveJar)).json()) as {
      twoFactorRedirect?: boolean;
    };
    expect(gatedBody.twoFactorRedirect).toBe(true);
  });
});

describe("trustDeviceBeforeHandler", () => {
  const ctx = (path: string, extra: Record<string, unknown> = {}) =>
    ({
      path,
      body: {},
      context: { createAuthCookie: (n: string) => ({ name: `__Secure-${n}` }) },
      ...extra,
    }) as never;

  test("ignores unrelated paths and bodies", async () => {
    expect(trustDeviceBeforeHandler(ctx("/two-factor/verify-totp"))).toBeUndefined();
    expect(trustDeviceBeforeHandler(ctx("/get-session"))).toBeUndefined();
    expect(
      trustDeviceBeforeHandler(ctx("/two-factor/verify-totp", { body: { trustDevice: false } }))
    ).toBeUndefined();
  });

  test.each(["/two-factor/verify-totp", "/two-factor/verify-backup-code", "/two-factor/verify-otp"])(
    "rejects trustDevice on %s",
    (path) => {
      expect(() => trustDeviceBeforeHandler(ctx(path, { body: { trustDevice: true } }))).toThrow(
        expect.objectContaining({ statusCode: 400 })
      );
    }
  );

  test("strips only the prefixed trust cookie from a sign-in request", async () => {
    const headers = new Headers({ cookie: "a=1; __Secure-trust_device=tok!id; b=2" });
    const patch = trustDeviceBeforeHandler(ctx("/sign-in/email", { headers }));
    expect(patch?.context.headers.get("cookie")).toBe("a=1; b=2");
    expect(headers.get("cookie")).toContain("trust_device");
  });

  test("strips duplicates, and a header holding only the trust cookie", async () => {
    const dup = new Headers({ cookie: "__Secure-trust_device=a; x=1; __Secure-trust_device=b" });
    expect(
      trustDeviceBeforeHandler(ctx("/sign-in/email", { headers: dup }))?.context.headers.get("cookie")
    ).toBe("x=1");
    const only = new Headers({ cookie: "__Secure-trust_device=a" });
    expect(
      trustDeviceBeforeHandler(ctx("/sign-in/email", { headers: only }))?.context.headers.get("cookie")
    ).toBe("");
  });

  test("leaves a sign-in without the cookie untouched", async () => {
    const headers = new Headers({ cookie: "a=1" });
    expect(trustDeviceBeforeHandler(ctx("/sign-in/email", { headers }))).toBeUndefined();
    expect(trustDeviceBeforeHandler(ctx("/sign-in/email"))).toBeUndefined();
  });
});
