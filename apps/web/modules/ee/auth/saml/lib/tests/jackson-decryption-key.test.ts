import { createPrivateKey, createPublicKey } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import init from "../jackson";

// A real jackson on its in-memory store, not a mock: what is under test is that the key `init` hands out comes from
// the certificate jackson itself generated and publishes, which only the `x509` copy `controllers` set up holds.

const created = vi.hoisted(() => ({ jackson: undefined as unknown }));

vi.mock("@/lib/constants", () => ({
  SAML_AUDIENCE: "https://saml.example.com",
  SAML_DATABASE_URL: "unused",
  SAML_PATH: "/api/auth/saml/callback",
  WEBAPP_URL: "https://app.example.com",
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsSamlSsoEnabled: vi.fn(async () => true) }));
vi.mock("@/modules/ee/auth/saml/lib/preload-connection", () => ({ preloadConnection: vi.fn() }));
vi.mock("@boxyhq/saml-jackson", async (importOriginal) => {
  const jackson = await importOriginal<typeof import("@boxyhq/saml-jackson")>();
  return {
    ...jackson,
    controllers: async (opts: Parameters<typeof jackson.controllers>[0]) => {
      created.jackson = await jackson.controllers({ ...opts, db: { engine: "mem" }, noAnalytics: true });
      return created.jackson;
    },
  };
});

describe("init's decryption key", () => {
  test("is the private key of the SP certificate jackson publishes", async () => {
    global.oauthController = undefined;
    global.connectionController = undefined;
    global.samlDecryptionKey = undefined;
    const instance = await init();
    const jackson = created.jackson as Awaited<ReturnType<typeof import("@boxyhq/saml-jackson").controllers>>;
    const { publicKey: certificate } = await jackson.spConfig.get();

    const key = await instance!.getDecryptionKey();

    const fromKey = createPublicKey(createPrivateKey(key)).export({ type: "spki", format: "pem" });
    expect(fromKey).toBe(createPublicKey(certificate).export({ type: "spki", format: "pem" }));
  }, 30_000);
});
