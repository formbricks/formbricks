import { createDecipheriv } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { backfillIntegrationTokens, encryptConfigCredentials, encryptToken } from "./migration";

vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

const KEY_HEX = "0123456789abcdef".repeat(4);
const KEY_LATIN1 = "abcdefghijklmnopqrstuvwxyz012345";

// Independent decryption of the `apps/web/lib/crypto.ts` format (the web test covers the real helper).
const decrypt = (payload: string, key: string): string => {
  const [iv, data, tag] = payload.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, key.length === 32 ? "latin1" : "hex"),
    Buffer.from(iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return decipher.update(data, "hex", "utf8") + decipher.final("utf8");
};

describe("encryptToken", () => {
  test.each([KEY_HEX, KEY_LATIN1])("round-trips with a %s key", (key) => {
    expect(decrypt(encryptToken("xoxb-secret", key), key)).toBe("xoxb-secret");
  });

  test("uses a fresh iv per call", () => {
    expect(encryptToken("a", KEY_HEX)).not.toBe(encryptToken("a", KEY_HEX));
  });

  test("rejects a key that is not 32 bytes", () => {
    expect(() => encryptToken("a", "short")).toThrow(/ENCRYPTION_KEY/);
  });
});

describe("encryptConfigCredentials", () => {
  test("encrypts plaintext credentials and keeps the rest", () => {
    const next = encryptConfigCredentials(
      { data: [1], email: "e", key: { access_token: "a", refresh_token: "r", scope: "s" } },
      KEY_HEX
    ) as { data: number[]; key: Record<string, string> };

    expect(decrypt(next.key.access_token, KEY_HEX)).toBe("a");
    expect(decrypt(next.key.refresh_token, KEY_HEX)).toBe("r");
    expect(next).toMatchObject({ data: [1], key: { scope: "s" } });
  });

  test("returns null when nothing needs encrypting", () => {
    const encrypted = encryptToken("a", KEY_HEX);
    expect(encryptConfigCredentials({ key: { access_token: encrypted } }, KEY_HEX)).toBeNull();
    expect(encryptConfigCredentials({ key: { access_token: "", refresh_token: "" } }, KEY_HEX)).toBeNull();
    expect(encryptConfigCredentials({ data: [] }, KEY_HEX)).toBeNull();
    expect(encryptConfigCredentials(null, KEY_HEX)).toBeNull();
  });
});

describe("backfillIntegrationTokens", () => {
  const prismaWith = (pages: { id: string; config: unknown }[][], written: number[] = []) => {
    const queue = [...pages];
    return {
      $queryRawUnsafe: vi.fn(() => Promise.resolve(queue.shift() ?? [])),
      $executeRawUnsafe: vi.fn(() => Promise.resolve(written.shift() ?? 1)),
    } as never;
  };

  test("writes each row once and reports the counts", async () => {
    const prisma = prismaWith([[{ id: "a", config: { key: { access_token: "x" } } }]]);
    expect(await backfillIntegrationTokens(prisma, KEY_HEX)).toEqual({
      scanned: 1,
      updated: 1,
      raceRetries: 0,
      skipped: [],
    });
  });

  test("retries a row whose config changed under it, then skips one that keeps changing", async () => {
    const row = { id: "a", config: { key: { access_token: "x" } } };
    const prisma = prismaWith([[row], [row], [row], [row]], [0, 0, 0, 0]);
    const stats = await backfillIntegrationTokens(prisma, KEY_HEX);
    expect(stats).toMatchObject({ updated: 0, raceRetries: 3, skipped: ["a"] });
  });

  test("refuses without a key before writing anything", async () => {
    const prisma = prismaWith([[{ id: "a", config: { key: { access_token: "x" } } }]]);
    await expect(backfillIntegrationTokens(prisma, undefined)).rejects.toThrow(/ENCRYPTION_KEY/);
    expect((prisma as { $executeRawUnsafe: unknown }).$executeRawUnsafe).not.toHaveBeenCalled();
  });

  test("needs no key when there is nothing to encrypt", async () => {
    expect(await backfillIntegrationTokens(prismaWith([]), undefined)).toMatchObject({ scanned: 0 });
  });
});
