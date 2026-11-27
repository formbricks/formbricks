import { headers } from "next/headers";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { hashSha256 } from "@/lib/crypto";
import { GET } from "./route";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@formbricks/database", () => ({
  prisma: { apiKey: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/app/api/v1/management/me/lib/utils", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/lib/crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/crypto")>();
  return { ...actual, verifySecret: vi.fn(actual.verifySecret) };
});

const SECRET = "a-32-byte-random-secret-value-xx";

const workspace = {
  id: "ws1",
  organizationId: "org1",
  legacyEnvironmentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "WS",
  appSetupCompleted: true,
};

const keyRow = (lookupHash: string | null) => ({
  id: "key1",
  organizationId: "org1",
  lastUsedAt: new Date(),
  lookupHash,
  apiKeyWorkspaces: [{ permission: "read", workspace }],
});

const sendKey = (key: string) =>
  vi.mocked(headers).mockResolvedValue({ get: (n: string) => (n === "x-api-key" ? key : null) } as never);

describe("GET /api/v1/management/me with a v2 (fbk_) API key", () => {
  beforeEach(() => vi.clearAllMocks());

  test("an unknown key is rejected with 401 and never runs bcrypt (security review #13)", async () => {
    const { verifySecret } = await import("@/lib/crypto");
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null);
    sendKey(`fbk_${SECRET}`);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { lookupHash: hashSha256(SECRET) } })
    );
    expect(verifySecret).not.toHaveBeenCalled();
  });

  test("a key whose row is found by its lookup hash authenticates without bcrypt", async () => {
    const { verifySecret } = await import("@/lib/crypto");
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(keyRow(hashSha256(SECRET)) as never);
    sendKey(`fbk_${SECRET}`);

    const res = await GET();

    expect(res.status).toBe(200);
    expect((await res.json()).workspace.id).toBe("ws1");
    expect(verifySecret).not.toHaveBeenCalled();
  });

  test("a row whose stored lookup hash does not match the presented secret is rejected", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(keyRow("f".repeat(64)) as never);
    sendKey(`fbk_${SECRET}`);

    expect((await GET()).status).toBe(401);
  });
});
