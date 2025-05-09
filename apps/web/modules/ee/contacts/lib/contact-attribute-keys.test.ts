import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getContactAttributeKeys } from "./contact-attribute-keys";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttributeKey: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/cache", () => ({ cache: (fn) => fn }));
vi.mock("@/lib/cache/contact-attribute-key", () => ({
  contactAttributeKeyCache: { tag: { byEnvironmentId: (envId) => `env-${envId}` } },
}));
vi.mock("react", () => ({ cache: (fn) => fn }));

const environmentId = "env-1";
const mockKeys = [
  { id: "id-1", key: "email", environmentId },
  { id: "id-2", key: "name", environmentId },
];

describe("getContactAttributeKeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns attribute keys for environment", async () => {
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(mockKeys);
    const result = await getContactAttributeKeys(environmentId);
    expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith({ where: { environmentId } });
    expect(result).toEqual(mockKeys);
  });

  test("returns empty array if none found", async () => {
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([]);
    const result = await getContactAttributeKeys(environmentId);
    expect(result).toEqual([]);
  });
});
