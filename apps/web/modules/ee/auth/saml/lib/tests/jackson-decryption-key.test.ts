import { controllers } from "@boxyhq/saml-jackson";
import { createPrivateKey, createPublicKey } from "node:crypto";
import { describe, expect, test } from "vitest";
import { getSamlDecryptionKey } from "../jackson";

// A real jackson on its in-memory store, not a mock: what is under test is that the key comes from the certificate
// jackson itself generated and publishes, which only its own module instance holds.
describe("getSamlDecryptionKey", () => {
  test("returns the private key of the SP certificate jackson publishes", async () => {
    const jackson = await controllers({
      externalUrl: "https://app.example.com",
      samlAudience: "https://saml.example.com",
      samlPath: "/api/auth/saml/callback",
      db: { engine: "mem" },
      noAnalytics: true,
      ssoTraces: { disable: true },
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    });
    const { publicKey: certificate } = await jackson.spConfig.get();

    const key = await getSamlDecryptionKey();

    const fromKey = createPublicKey(createPrivateKey(key)).export({ type: "spki", format: "pem" });
    expect(fromKey).toBe(createPublicKey(certificate).export({ type: "spki", format: "pem" }));
    await jackson.close();
  }, 30_000);
});
