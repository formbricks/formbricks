import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createAuthzedReleaseManifestDigest, readAuthzedReleaseManifest } from "./release-manifest";

vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));

const validManifest = {
  authorizationMode: "spicedb_authoritative",
  clientContractVersion: 1,
  migrationHead: "20260911090000_add_authzed_activation_protocol",
  protocolVersion: 1,
  sourceRevision: "16663b0eaaa1010c0c62b7f1c8f207695def8167",
} as const;

describe("AuthZed release manifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(validManifest));
  });

  test("accepts the bounded embedded build identity", async () => {
    await expect(readAuthzedReleaseManifest()).resolves.toEqual(validManifest);
    expect(createAuthzedReleaseManifestDigest(validManifest)).toBe("sha256:fake-hash");
  });

  test.each([
    ["migrationHead", "migration"],
    ["migrationHead", `20260911090000_${"a".repeat(97)}`],
    ["sourceRevision", "revision with whitespace"],
    ["sourceRevision", `a${"b".repeat(128)}`],
    ["protocolVersion", 2],
    ["clientContractVersion", 2],
    ["authorizationMode", "shadow"],
  ])("rejects an invalid %s without exposing its value", async (field, value) => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ ...validManifest, [field]: value }));

    const result = readAuthzedReleaseManifest();
    await expect(result).rejects.toMatchObject({
      code: "authzed_activation_required",
      operation: "activation_release_manifest",
    });
    await expect(result).rejects.not.toThrow(String(value));
  });
});
