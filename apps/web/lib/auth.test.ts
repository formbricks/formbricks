import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { AuthenticationError } from "@formbricks/types/errors";
import {
  hasOrganizationAccess,
  hasOrganizationAuthority,
  hasOrganizationOwnership,
  hashPassword,
  isManagerOrOwner,
  isOwner,
  verifyPassword,
} from "./auth";

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    membership: {
      findUnique: vi.fn(),
    },
  },
}));

describe("Password Management", () => {
  test("hashPassword should hash a password", async () => {
    const password = "testPassword123";
    const hashedPassword = await hashPassword(password);
    expect(hashedPassword).toBeDefined();
    expect(hashedPassword).not.toBe(password);
  });

  test("verifyPassword should verify a correct password", async () => {
    const password = "testPassword123";
    const hashedPassword = await hashPassword(password);
    const isValid = await verifyPassword(password, hashedPassword);
    expect(isValid).toBe(true);
  });

  test("verifyPassword should reject an incorrect password", async () => {
    const password = "testPassword123";
    const hashedPassword = await hashPassword(password);
    const isValid = await verifyPassword("wrongPassword", hashedPassword);
    expect(isValid).toBe(false);
  });
});

describe("Organization Access", () => {
  const mockUserId = "user123";
  const mockOrgId = "org123";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("hasOrganizationAccess should return true when user has membership", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "membership123",
      userId: mockUserId,
      organizationId: mockOrgId,
      role: "member",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const hasAccess = await hasOrganizationAccess(mockUserId, mockOrgId);
    expect(hasAccess).toBe(true);
  });

  test("hasOrganizationAccess should return false when user has no membership", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

    const hasAccess = await hasOrganizationAccess(mockUserId, mockOrgId);
    expect(hasAccess).toBe(false);
  });

  test("isManagerOrOwner should return true for manager role", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "membership123",
      userId: mockUserId,
      organizationId: mockOrgId,
      role: "manager",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const isManager = await isManagerOrOwner(mockUserId, mockOrgId);
    expect(isManager).toBe(true);
  });

  test("isManagerOrOwner should return true for owner role", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "membership123",
      userId: mockUserId,
      organizationId: mockOrgId,
      role: "owner",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const isOwner = await isManagerOrOwner(mockUserId, mockOrgId);
    expect(isOwner).toBe(true);
  });

  test("isManagerOrOwner should return false for member role", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "membership123",
      userId: mockUserId,
      organizationId: mockOrgId,
      role: "member",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const isManagerOrOwnerRole = await isManagerOrOwner(mockUserId, mockOrgId);
    expect(isManagerOrOwnerRole).toBe(false);
  });

  test("isOwner should return true only for owner role", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "membership123",
      userId: mockUserId,
      organizationId: mockOrgId,
      role: "owner",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const isOwnerRole = await isOwner(mockUserId, mockOrgId);
    expect(isOwnerRole).toBe(true);
  });

  test("isOwner should return false for non-owner roles", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "membership123",
      userId: mockUserId,
      organizationId: mockOrgId,
      role: "manager",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const isOwnerRole = await isOwner(mockUserId, mockOrgId);
    expect(isOwnerRole).toBe(false);
  });
});

describe("Organization Authority", () => {
  const mockUserId = "user123";
  const mockOrgId = "org123";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("hasOrganizationAuthority should return true for manager", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "membership123",
      userId: mockUserId,
      organizationId: mockOrgId,
      role: "manager",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const hasAuthority = await hasOrganizationAuthority(mockUserId, mockOrgId);
    expect(hasAuthority).toBe(true);
  });

  test("hasOrganizationAuthority should throw for non-member", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

    await expect(hasOrganizationAuthority(mockUserId, mockOrgId)).rejects.toThrow(AuthenticationError);
  });

  test("hasOrganizationAuthority should throw for member role", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "membership123",
      userId: mockUserId,
      organizationId: mockOrgId,
      role: "member",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(hasOrganizationAuthority(mockUserId, mockOrgId)).rejects.toThrow(AuthenticationError);
  });

  test("hasOrganizationOwnership should return true for owner", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "membership123",
      userId: mockUserId,
      organizationId: mockOrgId,
      role: "owner",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const hasOwnership = await hasOrganizationOwnership(mockUserId, mockOrgId);
    expect(hasOwnership).toBe(true);
  });

  test("hasOrganizationOwnership should throw for non-member", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

    await expect(hasOrganizationOwnership(mockUserId, mockOrgId)).rejects.toThrow(AuthenticationError);
  });

  test("hasOrganizationOwnership should throw for non-owner roles", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "membership123",
      userId: mockUserId,
      organizationId: mockOrgId,
      role: "manager",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(hasOrganizationOwnership(mockUserId, mockOrgId)).rejects.toThrow(AuthenticationError);
  });
});
