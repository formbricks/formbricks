import { apiKeyCache } from "@/lib/cache/api-key";
import { ApiKey, ApiKeyPermission, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TApiKeyWithEnvironmentPermission } from "../types/api-keys";
import { createApiKey, deleteApiKey, getApiKeysWithEnvironmentPermissions } from "./api-key";

const mockApiKey: ApiKey = {
  id: "apikey123",
  label: "Test API Key",
  hashedKey: "hashed_key_value",
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
      findMany: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache/api-key", () => ({
  apiKeyCache: {
    revalidate: vi.fn(),
    tag: {
      byOrganizationId: vi.fn(),
    },
  },
}));

vi.mock("crypto", () => ({
  randomBytes: () => ({
    toString: () => "generated_key",
  }),
  createHash: () => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue("hashed_key_value"),
  }),
}));

describe("API Key Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getApiKeysWithEnvironmentPermissions", () => {
    it("retrieves API keys successfully", async () => {
      vi.mocked(prisma.apiKey.findMany).mockResolvedValueOnce([mockApiKeyWithEnvironments]);
      vi.mocked(apiKeyCache.tag.byOrganizationId).mockReturnValue("org-tag");

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

    it("throws DatabaseError on prisma error", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.apiKey.findMany).mockRejectedValueOnce(errToThrow);
      vi.mocked(apiKeyCache.tag.byOrganizationId).mockReturnValue("org-tag");

      await expect(getApiKeysWithEnvironmentPermissions("org123")).rejects.toThrow(DatabaseError);
    });
  });

  describe("deleteApiKey", () => {
    it("deletes an API key successfully", async () => {
      vi.mocked(prisma.apiKey.delete).mockResolvedValueOnce(mockApiKey);

      const result = await deleteApiKey(mockApiKey.id);

      expect(result).toEqual(mockApiKey);
      expect(prisma.apiKey.delete).toHaveBeenCalledWith({
        where: {
          id: mockApiKey.id,
        },
      });
      expect(apiKeyCache.revalidate).toHaveBeenCalled();
    });

    it("throws DatabaseError on prisma error", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.apiKey.delete).mockRejectedValueOnce(errToThrow);

      await expect(deleteApiKey(mockApiKey.id)).rejects.toThrow(DatabaseError);
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

    it("creates an API key successfully", async () => {
      vi.mocked(prisma.apiKey.create).mockResolvedValueOnce(mockApiKey);

      const result = await createApiKey("org123", "user123", mockApiKeyData);

      expect(result).toEqual({ ...mockApiKey, actualKey: "generated_key" });
      expect(prisma.apiKey.create).toHaveBeenCalled();
      expect(apiKeyCache.revalidate).toHaveBeenCalled();
    });

    it("creates an API key with environment permissions successfully", async () => {
      vi.mocked(prisma.apiKey.create).mockResolvedValueOnce(mockApiKeyWithEnvironments);

      const result = await createApiKey("org123", "user123", {
        ...mockApiKeyData,
        environmentPermissions: [{ environmentId: "env123", permission: ApiKeyPermission.manage }],
      });

      expect(result).toEqual({ ...mockApiKeyWithEnvironments, actualKey: "generated_key" });
      expect(prisma.apiKey.create).toHaveBeenCalled();
      expect(apiKeyCache.revalidate).toHaveBeenCalled();
    });

    it("throws DatabaseError on prisma error", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      vi.mocked(prisma.apiKey.create).mockRejectedValueOnce(errToThrow);

      await expect(createApiKey("org123", "user123", mockApiKeyData)).rejects.toThrow(DatabaseError);
    });
  });
});
