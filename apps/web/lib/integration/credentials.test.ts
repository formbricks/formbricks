import { describe, expect, test, vi } from "vitest";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";
import {
  decryptIntegrationConfig,
  encryptIntegrationConfig,
  hasEncryptedCredentials,
  isEncryptedCredential,
} from "./credentials";

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  // A real key: the unit harness's placeholder is not a valid AES key length.
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
}));

const config = (key: Record<string, unknown>) => ({ key, data: [], email: "a@b.co" });

describe("integration credentials", () => {
  test("encrypts access and refresh tokens and nothing else in the key", () => {
    const encrypted = encryptIntegrationConfig(
      "googleSheets",
      config({ access_token: "ya29.plain", refresh_token: "1//plain", scope: "s", expiry_date: 5 })
    );

    const key = encrypted.key;
    expect(isEncryptedCredential(key.access_token as string)).toBe(true);
    expect(symmetricDecrypt(key.access_token as string, ENCRYPTION_KEY)).toBe("ya29.plain");
    expect(symmetricDecrypt(key.refresh_token as string, ENCRYPTION_KEY)).toBe("1//plain");
    expect(key).toMatchObject({ scope: "s", expiry_date: 5 });
    expect(encrypted).toMatchObject({ data: [], email: "a@b.co" });
  });

  test("is idempotent: an encrypted value is not encrypted again", () => {
    const once = encryptIntegrationConfig("slack", config({ access_token: "xoxb-1" }));
    expect(encryptIntegrationConfig("slack", once)).toEqual(once);
  });

  test("decrypts what it encrypted and passes legacy plaintext through", () => {
    const encrypted = encryptIntegrationConfig("airtable", config({ access_token: "a", refresh_token: "r" }));
    expect(decryptIntegrationConfig("airtable", encrypted).key).toEqual({
      access_token: "a",
      refresh_token: "r",
    });

    const legacy = config({ access_token: "xoxb-legacy" });
    expect(decryptIntegrationConfig("slack", legacy)).toEqual(legacy);
  });

  test("leaves empty tokens alone", () => {
    const empty = config({ access_token: "", refresh_token: "" });
    expect(encryptIntegrationConfig("googleSheets", empty)).toEqual(empty);
  });

  test("does not touch Notion, which encrypts and decrypts its own token", () => {
    const notion = config({ access_token: symmetricEncrypt("secret_notion", ENCRYPTION_KEY), bot_id: "b" });
    expect(hasEncryptedCredentials("notion")).toBe(false);
    expect(encryptIntegrationConfig("notion", notion)).toBe(notion);
    expect(decryptIntegrationConfig("notion", notion)).toBe(notion);
  });

  test("passes a config without a key through", () => {
    const noKey: { key?: unknown; data: unknown[] } = { data: [] };
    expect(encryptIntegrationConfig("slack", noKey)).toBe(noKey);
    expect(decryptIntegrationConfig("slack", noKey)).toBe(noKey);
  });

  test("a token encrypted with another key reads as no token, never as garbage, and is reported", () => {
    const foreign = symmetricEncrypt("x", "f".repeat(64));
    const ours = symmetricEncrypt("refresh", ENCRYPTION_KEY);
    const onUndecryptable = vi.fn();

    const decrypted = decryptIntegrationConfig(
      "slack",
      config({ access_token: foreign, refresh_token: ours, team: "T1" }),
      onUndecryptable
    );

    expect(decrypted.key).toEqual({ access_token: "", refresh_token: "refresh", team: "T1" });
    expect(onUndecryptable).toHaveBeenCalledTimes(1);
  });
});
