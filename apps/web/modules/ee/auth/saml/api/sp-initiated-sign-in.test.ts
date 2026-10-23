import { NextRequest } from "next/server";
import { createHash, createPublicKey, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { inflateRawSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { SAML_AUDIENCE, SAML_PATH, SAML_PRODUCT, SAML_TENANT, WEBAPP_URL } from "@/lib/constants";
import jackson from "@/modules/ee/auth/saml/lib/jackson";
import { createTestIdp } from "@/modules/ee/auth/saml/lib/tests/saml-test-idp";
import { GET as authorize } from "./authorize/route";
import { POST as callback } from "./callback/route";
import { POST as token } from "./token/route";
import { GET as userinfo } from "./userinfo/route";

// ENG-4045: an SP-initiated SAML sign-in, through Formbricks' four SAML routes in the order Better Auth's SAML
// provider calls them, on a real jackson (its in-memory store) with the connection preloaded from IdP metadata as in
// production. Nothing in the SAML path is stood in for: not jackson, saml20, xml-crypto, xml-encryption nor the
// callback's parse worker. Only the licence check, the rate limiter, Next's redirect and jackson's database are.

// vitestSetup.ts stubs `createHash` for every test; the IdP's digests and the PKCE challenge need the real one.
vi.unmock("crypto");

const idp = vi.hoisted(() => ({ metadataDir: "" }));

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get SAML_XML_DIR() {
    return idp.metadataDir;
  },
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsSamlSsoEnabled: vi.fn(async () => true) }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyIPRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => new Response(null, { status: 307, headers: { location: url } })),
}));
vi.mock("@boxyhq/saml-jackson", async (importOriginal) => {
  const jackson = await importOriginal<typeof import("@boxyhq/saml-jackson")>();
  return {
    ...jackson,
    controllers: (opts: Parameters<typeof jackson.controllers>[0]) =>
      jackson.controllers({ ...opts, db: { engine: "mem" }, noAnalytics: true }),
  };
});

const testIdp = createTestIdp();
// Better Auth's SAML provider (modules/ee/sso/lib/better-auth-providers.ts).
const BETTER_AUTH_CALLBACK = `${WEBAPP_URL}/api/auth/oauth2/callback/saml`;
const ACS_URL = `${WEBAPP_URL}${SAML_PATH}`;

const base64url = (buffer: Buffer) => buffer.toString("base64url");

/** The public half of jackson's SP certificate, which IdPs encrypt assertions to. */
const spPublicKey = async () => {
  const instance = await jackson();
  const privateKey = await instance!.getDecryptionKey();
  return createPublicKey(privateKey).export({ type: "spki", format: "pem" }).toString();
};

interface SignedXmlVerifier {
  loadSignature(signature: string): void;
  checkSignature(xml: string): boolean;
}

/** Whether `xml`'s enveloped signature verifies against `publicKey`, checked with the xml-crypto jackson signs with. */
const signatureVerifies = (xml: string, publicKey: string): boolean => {
  const fromJackson = createRequire(createRequire(import.meta.url).resolve("@boxyhq/saml-jackson"));
  const { SignedXml } = createRequire(fromJackson.resolve("@boxyhq/saml20"))("xml-crypto") as {
    SignedXml: new (options: { publicCert: string }) => SignedXmlVerifier;
  };
  const verifier = new SignedXml({ publicCert: publicKey });
  verifier.loadSignature(/<(?:\w+:)?Signature\b[\s\S]*<\/(?:\w+:)?Signature>/.exec(xml)?.[0] ?? "");
  return verifier.checkSignature(xml);
};

beforeAll(async () => {
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  idp.metadataDir = await mkdtemp(path.join(tmpdir(), "formbricks-saml-"));
  await writeFile(path.join(idp.metadataDir, "idp.xml"), testIdp.metadata);
});

afterAll(async () => {
  const { rm } = await import("node:fs/promises");
  if (idp.metadataDir) await rm(idp.metadataDir, { recursive: true, force: true });
});

/**
 * "Continue with SAML": Better Auth sends the browser to the authorize route, and jackson redirects it to the IdP
 * with a signed AuthnRequest (HTTP-Redirect binding: deflated, base64). When signing fails, jackson sends the browser
 * back to Better Auth with the reason instead, which is what ENG-4045 broke.
 */
const startSignIn = async () => {
  const codeVerifier = base64url(randomBytes(32));
  const state = base64url(randomBytes(16));
  const authorizeUrl = new URL(`${WEBAPP_URL}/api/auth/saml/authorize`);
  for (const [key, value] of Object.entries({
    response_type: "code",
    client_id: "dummy",
    redirect_uri: BETTER_AUTH_CALLBACK,
    state,
    code_challenge: base64url(createHash("sha256").update(codeVerifier).digest()),
    code_challenge_method: "S256",
    provider: "saml",
    tenant: SAML_TENANT,
    product: SAML_PRODUCT,
  })) {
    authorizeUrl.searchParams.set(key, value);
  }
  const authorizeResponse = await authorize(new NextRequest(authorizeUrl));

  const authorizeBody = authorizeResponse.status >= 400 ? await authorizeResponse.text() : "";
  expect(authorizeBody).toBe("");
  const idpRedirect = new URL(authorizeResponse.headers.get("location") ?? "");
  expect(idpRedirect.searchParams.get("error_description")).toBeNull();
  expect(`${idpRedirect.origin}${idpRedirect.pathname}`).toBe(testIdp.ssoUrl);
  const authnRequest = inflateRawSync(
    Buffer.from(idpRedirect.searchParams.get("SAMLRequest") ?? "", "base64")
  ).toString("utf8");
  expect(authnRequest).toContain(`AssertionConsumerServiceURL="${ACS_URL}"`);
  expect(signatureVerifies(authnRequest, await spPublicKey())).toBe(true);
  const requestId = /\bID="([^"]+)"/.exec(authnRequest)?.[1] ?? "";
  expect(requestId).not.toBe("");

  return { codeVerifier, state, relayState: idpRedirect.searchParams.get("RelayState") ?? "", requestId };
};

/** The IdP's POST back to the callback route. */
const postToCallback = (SAMLResponse: string, RelayState: string) =>
  callback(new Request(ACS_URL, { method: "POST", body: new URLSearchParams({ SAMLResponse, RelayState }) }));

describe("SP-initiated SAML sign-in (ENG-4045)", () => {
  test.each([
    ["a signed assertion", false],
    // Decrypted twice before jackson trusts it: by the callback's parse worker (ENG-4051), then by saml20.
    ["a signed assertion encrypted to the SP", true],
  ])(
    "signs the AuthnRequest, accepts %s and hands Better Auth the user",
    async (_name, encrypted) => {
      // 1. "Continue with SAML".
      const { codeVerifier, state, relayState, requestId } = await startSignIn();

      // 2. The IdP posts its signed response back to the callback route.
      const SAMLResponse = testIdp.signedResponse({
        requestId,
        acsUrl: ACS_URL,
        audience: SAML_AUDIENCE,
        email: "ada@example.com",
        encryptFor: encrypted ? await spPublicKey() : undefined,
      });
      expect(Buffer.from(SAMLResponse, "base64").toString("utf8").includes("EncryptedAssertion")).toBe(
        encrypted
      );
      const callbackResponse = await postToCallback(SAMLResponse, relayState);

      const callbackBody = callbackResponse.status >= 400 ? await callbackResponse.text() : "";
      expect(callbackBody).toBe("");
      const betterAuthRedirect = new URL(callbackResponse.headers.get("location") ?? "");
      expect(`${betterAuthRedirect.origin}${betterAuthRedirect.pathname}`).toBe(BETTER_AUTH_CALLBACK);
      expect(betterAuthRedirect.searchParams.get("state")).toBe(state);
      const code = betterAuthRedirect.searchParams.get("code") ?? "";

      // 3. Better Auth exchanges the code, with its PKCE verifier, for jackson's access token.
      const tokenResponse = await token(
        new Request(`${WEBAPP_URL}/api/auth/saml/token`, {
          method: "POST",
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            code_verifier: codeVerifier,
            redirect_uri: BETTER_AUTH_CALLBACK,
            client_id: "dummy",
            client_secret: "dummy",
          }),
        })
      );
      const { access_token } = (await tokenResponse.json()) as { access_token: string };

      // 4. ...and reads the signed-in user from the userinfo route.
      const userinfoResponse = await userinfo(
        new Request(`${WEBAPP_URL}/api/auth/saml/userinfo`, {
          headers: { authorization: `Bearer ${access_token}` },
        })
      );
      expect(await userinfoResponse.json()).toMatchObject({
        email: "ada@example.com",
        firstName: "Test",
        lastName: "User",
      });
    },
    30_000
  );

  // ENG-4045 moves xml-crypto, which checks the IdP's signature, onto its own xmldom copy. Signing working is only half
  // of it: a signature that does not hold must still be refused, with no code handed to Better Auth.
  const otherIdp = createTestIdp();
  test.each([
    [
      "signed with a key the connection does not trust",
      (options: Parameters<typeof testIdp.signedResponse>[0]) => otherIdp.signedResponse(options),
    ],
    [
      "changed after it was signed",
      (options: Parameters<typeof testIdp.signedResponse>[0]) => {
        const signed = Buffer.from(testIdp.signedResponse(options), "base64").toString("utf8");
        const changed = signed.replaceAll(options.email, "mallory@example.com");
        expect(changed).not.toBe(signed);
        return Buffer.from(changed, "utf8").toString("base64");
      },
    ],
  ])(
    "refuses a response %s",
    async (_name, respond) => {
      const { relayState, requestId } = await startSignIn();
      const SAMLResponse = respond({
        requestId,
        acsUrl: ACS_URL,
        audience: SAML_AUDIENCE,
        email: "ada@example.com",
      });

      const callbackResponse = await postToCallback(SAMLResponse, relayState);

      expect(callbackResponse.status).toBe(400);
      expect(callbackResponse.headers.get("location")).toBeNull();
      expect(await callbackResponse.json()).toMatchObject({ code: "bad_request" });
    },
    30_000
  );
});
