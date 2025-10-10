import { ApiKey, ApiKeyPermission, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TApiKeyWithEnvironmentPermission } from "../types/api-keys";
import {
  createApiKey,
  deleteApiKey,
  getApiKeyWithPermissions,
  getApiKeysWithEnvironmentPermissions,
  updateApiKey,
} from "./api-key";

const mockApiKey: ApiKey = {
  id: "apikey123",
  label: "Test API Key",
  hashedKey: "$2a$12$mockBcryptHashFortestSecret123", // bcrypt hash for hybrid approach
  lookupHash: "sha256LookupHashValue",
  createdAt: new Date(),
  createdBy: "user123",
  organizationId: "org123",
  lastUsedAt: null,
  organizationAccess: {
    accessControl: {
      read: false,
      write: false,
    },
  },
};

const mockApiKeyWithEnvironments: TApiKeyWithEnvironmentPermission = {
  ...mockApiKey,
  apiKeyEnvironments: [
    {
      environmentId: "env123",
      permission: ApiKeyPermission.manage,
    },
  ],
};

// Mock modules before tests
vi.mock("@formbricks/database", () => ({
  prisma: {
    apiKey: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("crypto", async () => {
  const actual = await vi.importActual<typeof import("crypto")>("crypto");
  return {
    ...actual,
    randomBytes: vi.fn((_size: number) => ({
      toString: (_encoding: string) => "testSecret123",
    })),
  };
});

vi.mock("@/lib/crypto", () => ({
  hashSha256: vi.fn((input: string) => {
    // Return different hashes for lookup vs legacy
    if (input === "testSecret123") {
      return "sha256LookupHashValue";
    }
    return "sha256HashValue";
  }),
  parseApiKeyV2: vi.fn((key: string) => {
    if (key.startsWith("fbk_")) {
      const secret = key.slice(4);
      return { secret };
    }
    return null;
  }),
  hashSecret: vi.fn(async (secret: string, _cost: number) => {
    // Return a mock bcrypt hash
    return `$2a$12$mockBcryptHashFor${secret}`;
  }),
  verifySecret: vi.fn(async (secret: string, hash: string) => {
    // Control hash for timing attack prevention (should always return false)
    const controlHash = "$2b$12$fzHf9le13Ss9UJ04xzmsjODXpFJxz6vsnupoepF5FiqDECkX2BH5q";
    if (hash === controlHash) {
      return false;
    }
    // Simple mock verification - just check if hash contains the secret
    return hash.includes(secret) || hash === "sha256HashValue";
  }),
}));

describe("API Key Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getApiKeysWithEnvironmentPermissions", () => {
    test("retrieves API keys successfully", async () => {
      vi.mocked(prisma.apiKey.findMany).mockResolvedValueOnce([mockApiKeyWithEnvironments] as any);

      const result = await getApiKeysWithEnvironmentPermissions("clj28r6va000409j3ep7h8xzk");

      expect(result).toEqual([mockApiKeyWithEnvironments]);
      expect(prisma.apiKey.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "clj28r6va000409j3ep7h8xzk",
        },
        select: {
          apiKeyEnvironments: {
            select: {
              environmentId: true,
              permission: true,
            },
          },
          createdAt: true,
          id: true,
          label: true,
          organizationAccess: true,
        },
      });
    });

    test("throws DatabaseError on prisma error", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.apiKey.findMany).mockRejectedValueOnce(errToThrow);

      await expect(getApiKeysWithEnvironmentPermissions("org123")).rejects.toThrow(DatabaseError);
    });

    test("throws error if prisma throws an error", async () => {
      const errToThrow = new Error("Mock error message");
      vi.mocked(prisma.apiKey.findMany).mockRejectedValueOnce(errToThrow);

      await expect(getApiKeysWithEnvironmentPermissions("org123")).rejects.toThrow(errToThrow);
    });
  });

  describe("getApiKeyWithPermissions", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    test("returns api key with permissions for v2 format (fbk_secret) but does NOT update lastUsedAt when within 30s", async () => {
      const { verifySecret } = await import("@/lib/crypto");
      const recentDate = new Date(Date.now() - 1000 * 10); // 10 seconds ago (too recent)
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValueOnce({
        ...mockApiKey,
        lastUsedAt: recentDate,
      } as any);

      const result = await getApiKeyWithPermissions("fbk_testSecret123");

      expect(result).toMatchObject({
        ...mockApiKey,
        lastUsedAt: recentDate,
      });
      expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { lookupHash: "sha256LookupHashValue" },
        include: expect.any(Object),
      });
      // Verify hybrid approach: bcrypt verification is called
      expect(verifySecret).toHaveBeenCalledWith("testSecret123", mockApiKey.hashedKey);
      // Should NOT update because lastUsedAt is too recent (< 30s)
      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    test("returns api key with permissions for v2 format and DOES update lastUsedAt when null (first use)", async () => {
      const { verifySecret } = await import("@/lib/crypto");
      const mockUpdatePromise = {
        catch: vi.fn().mockReturnThis(),
      };
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValueOnce({
        ...mockApiKey,
        lastUsedAt: null,
      } as any);
      vi.mocked(prisma.apiKey.update).mockReturnValueOnce(mockUpdatePromise as any);

      const result = await getApiKeyWithPermissions("fbk_testSecret123");

      expect(result).toMatchObject({
        ...mockApiKey,
        lastUsedAt: null,
      });
      expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { lookupHash: "sha256LookupHashValue" },
        include: expect.any(Object),
      });
      // Verify hybrid approach: bcrypt verification is called
      expect(verifySecret).toHaveBeenCalledWith("testSecret123", mockApiKey.hashedKey);
      // SHOULD update because lastUsedAt is null (first use)
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: "apikey123" },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    test("returns api key with permissions for v2 format and DOES update lastUsedAt when older than 30s", async () => {
      const { verifySecret } = await import("@/lib/crypto");
      const oldDate = new Date(Date.now() - 1000 * 60); // 60 seconds ago (old enough)
      const mockUpdatePromise = {
        catch: vi.fn().mockReturnThis(),
      };
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValueOnce({
        ...mockApiKey,
        lastUsedAt: oldDate,
      } as any);
      vi.mocked(prisma.apiKey.update).mockReturnValueOnce(mockUpdatePromise as any);

      const result = await getApiKeyWithPermissions("fbk_testSecret123");

      expect(result).toMatchObject({
        ...mockApiKey,
        lastUsedAt: oldDate,
      });
      expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { lookupHash: "sha256LookupHashValue" },
        include: expect.any(Object),
      });
      // Verify hybrid approach: bcrypt verification is called
      expect(verifySecret).toHaveBeenCalledWith("testSecret123", mockApiKey.hashedKey);
      // SHOULD update because lastUsedAt is old enough (> 30s)
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: "apikey123" },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    test("returns api key with permissions for v1 legacy format but does NOT update lastUsedAt when within 30s", async () => {
      const recentDate = new Date(Date.now() - 1000 * 20); // 20 seconds ago (too recent)
      vi.mocked(prisma.apiKey.findFirst).mockResolvedValueOnce({
        ...mockApiKey,
        lastUsedAt: recentDate,
      } as any);

      const result = await getApiKeyWithPermissions("legacy-api-key");

      expect(result).toMatchObject({
        ...mockApiKey,
        lastUsedAt: recentDate,
      });
      expect(prisma.apiKey.findFirst).toHaveBeenCalledWith({
        where: { hashedKey: "sha256HashValue" },
        include: expect.any(Object),
      });
      // Should NOT update because lastUsedAt is too recent (< 30s)
      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    test("returns api key and DOES update lastUsedAt for legacy format when older than 30s", async () => {
      const oldDate = new Date(Date.now() - 1000 * 45); // 45 seconds ago (old enough)
      const mockUpdatePromise = {
        catch: vi.fn().mockReturnThis(),
      };
      vi.mocked(prisma.apiKey.findFirst).mockResolvedValueOnce({
        ...mockApiKey,
        lastUsedAt: oldDate,
      } as any);
      vi.mocked(prisma.apiKey.update).mockReturnValueOnce(mockUpdatePromise as any);

      const result = await getApiKeyWithPermissions("legacy-api-key");

      expect(result).toMatchObject({
        ...mockApiKey,
        lastUsedAt: oldDate,
      });
      expect(prisma.apiKey.findFirst).toHaveBeenCalledWith({
        where: { hashedKey: "sha256HashValue" },
        include: expect.any(Object),
      });
      // SHOULD update because lastUsedAt is old enough (> 30s)
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: "apikey123" },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    test("returns null if v2 api key not found", async () => {
      const { verifySecret } = await import("@/lib/crypto");
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null);

      const result = await getApiKeyWithPermissions("fbk_invalid_secret");

      expect(result).toBeNull();
      // Verify timing attack prevention: verifySecret should be called even when key not found
      expect(verifySecret).toHaveBeenCalledWith(
        "invalid_secret",
        "$2b$12$fzHf9le13Ss9UJ04xzmsjODXpFJxz6vsnupoepF5FiqDECkX2BH5q" // control hash
      );
    });

    test("returns null if v2 api key bcrypt verification fails", async () => {
      const { verifySecret } = await import("@/lib/crypto");
      // Mock verifySecret to return false for this test
      vi.mocked(verifySecret).mockResolvedValueOnce(false);

      vi.mocked(prisma.apiKey.findUnique).mockResolvedValueOnce({
        ...mockApiKey,
      } as any);

      const result = await getApiKeyWithPermissions("fbk_wrongSecret");

      expect(result).toBeNull();
      expect(verifySecret).toHaveBeenCalledWith("wrongSecret", mockApiKey.hashedKey);
    });

    test("returns null if v1 api key not found", async () => {
      vi.mocked(prisma.apiKey.findFirst).mockResolvedValue(null);
      const result = await getApiKeyWithPermissions("invalid-legacy-key");
      expect(result).toBeNull();
    });

    test("throws DatabaseError on prisma error for v2 key", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.apiKey.findUnique).mockRejectedValueOnce(errToThrow);
      await expect(getApiKeyWithPermissions("fbk_testSecret123")).rejects.toThrow(DatabaseError);
    });

    test("throws error if prisma throws an error for v2 key", async () => {
      const errToThrow = new Error("Mock error message");
      vi.mocked(prisma.apiKey.findUnique).mockRejectedValueOnce(errToThrow);
      await expect(getApiKeyWithPermissions("fbk_testSecret123")).rejects.toThrow(errToThrow);
    });
  });

  describe("deleteApiKey", () => {
    test("deletes an API key successfully", async () => {
      vi.mocked(prisma.apiKey.delete).mockResolvedValueOnce(mockApiKey);

      const result = await deleteApiKey(mockApiKey.id);

      expect(result).toEqual(mockApiKey);
      expect(prisma.apiKey.delete).toHaveBeenCalledWith({
        where: {
          id: mockApiKey.id,
        },
      });
    });

    test("throws DatabaseError on prisma error", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.apiKey.delete).mockRejectedValueOnce(errToThrow);

      await expect(deleteApiKey(mockApiKey.id)).rejects.toThrow(DatabaseError);
    });

    test("throws error if prisma throws an error", async () => {
      const errToThrow = new Error("Mock error message");
      vi.mocked(prisma.apiKey.delete).mockRejectedValueOnce(errToThrow);

      await expect(deleteApiKey(mockApiKey.id)).rejects.toThrow(errToThrow);
    });
  });

  describe("createApiKey", () => {
    const mockApiKeyData = {
      label: "Test API Key",
      organizationAccess: {
        accessControl: {
          read: false,
          write: false,
        },
      },
    };

    const mockApiKeyWithEnvironments = {
      ...mockApiKey,
      apiKeyEnvironments: [
        {
          id: "env-perm-123",
          apiKeyId: "apikey123",
          environmentId: "env123",
          permission: ApiKeyPermission.manage,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    test("creates an API key successfully with v2 format", async () => {
      vi.mocked(prisma.apiKey.create).mockResolvedValueOnce(mockApiKey);

      const result = await createApiKey("org123", "user123", mockApiKeyData);

      expect(result).toEqual({ ...mockApiKey, actualKey: "fbk_testSecret123" });
      expect(prisma.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          label: "Test API Key",
          hashedKey: "$2a$12$mockBcryptHashFortestSecret123", // bcrypt hash
          lookupHash: "sha256LookupHashValue", // SHA-256 lookup hash
          createdBy: "user123",
        }),
        include: {
          apiKeyEnvironments: true,
        },
      });
    });

    test("creates an API key with environment permissions successfully", async () => {
      vi.mocked(prisma.apiKey.create).mockResolvedValueOnce(mockApiKeyWithEnvironments);

      const result = await createApiKey("org123", "user123", {
        ...mockApiKeyData,
        environmentPermissions: [{ environmentId: "env123", permission: ApiKeyPermission.manage }],
      });

      expect(result).toEqual({ ...mockApiKeyWithEnvironments, actualKey: "fbk_testSecret123" });
      expect(prisma.apiKey.create).toHaveBeenCalled();
    });

    test("throws DatabaseError on prisma error", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      vi.mocked(prisma.apiKey.create).mockRejectedValueOnce(errToThrow);

      await expect(createApiKey("org123", "user123", mockApiKeyData)).rejects.toThrow(DatabaseError);
    });

    test("throws error if prisma throws an error", async () => {
      const errToThrow = new Error("Mock error message");

      vi.mocked(prisma.apiKey.create).mockRejectedValueOnce(errToThrow);

      await expect(createApiKey("org123", "user123", mockApiKeyData)).rejects.toThrow(errToThrow);
    });
  });

  describe("updateApiKey", () => {
    test("updates an API key successfully", async () => {
      const updatedApiKey = { ...mockApiKey, label: "Updated API Key" };
      vi.mocked(prisma.apiKey.update).mockResolvedValueOnce(updatedApiKey);

      const result = await updateApiKey(mockApiKey.id, { label: "Updated API Key" });

      expect(result).toEqual(updatedApiKey);
      expect(prisma.apiKey.update).toHaveBeenCalled();
    });

    test("throws DatabaseError on prisma error", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      vi.mocked(prisma.apiKey.update).mockRejectedValueOnce(errToThrow);

      await expect(updateApiKey(mockApiKey.id, { label: "Updated API Key" })).rejects.toThrow(DatabaseError);
    });

    test("throws error if prisma throws an error", async () => {
      const errToThrow = new Error("Mock error message");

      vi.mocked(prisma.apiKey.update).mockRejectedValueOnce(errToThrow);

      await expect(updateApiKey(mockApiKey.id, { label: "Updated API Key" })).rejects.toThrow(errToThrow);
    });
  });
});
