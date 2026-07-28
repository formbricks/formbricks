import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthenticationError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import {
  hasOrganizationAccess,
  hasOrganizationAuthority,
  hasOrganizationOwnership,
  hashPassword,
  isManagerOrOwner,
  isOwner,
  verifyPassword,
} from "./auth";

const PASSWORD_TEST_TIMEOUT_MS = 30_000;

vi.mock("@/lib/authorization", () => ({
  can: vi.fn(),
}));

describe("Password Management", () => {
  test(
    "hashPassword should hash a password",
    async () => {
      const password = "testPassword123";
      const hashedPassword = await hashPassword(password);
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
    },
    PASSWORD_TEST_TIMEOUT_MS
  );

  test(
    "verifyPassword should verify a correct password",
    async () => {
      const password = "testPassword123";
      const hashedPassword = await hashPassword(password);
      const isValid = await verifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
    },
    PASSWORD_TEST_TIMEOUT_MS
  );

  test(
    "verifyPassword should reject an incorrect password",
    async () => {
      const password = "testPassword123";
      const hashedPassword = await hashPassword(password);
      const isValid = await verifyPassword("wrongPassword", hashedPassword);
      expect(isValid).toBe(false);
    },
    PASSWORD_TEST_TIMEOUT_MS
  );
});

describe("Organization Access", () => {
  const mockUserId = "user123";
  const mockOrgId = "org123";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("hasOrganizationAccess should return true when user has membership", async () => {
    vi.mocked(can).mockResolvedValue(true);

    const hasAccess = await hasOrganizationAccess(mockUserId, mockOrgId);
    expect(hasAccess).toBe(true);
    expect(can).toHaveBeenCalledWith({ type: "user", id: mockUserId }, "organization.read", {
      type: "organization",
      id: mockOrgId,
    });
  });

  test("hasOrganizationAccess should return false when user has no membership", async () => {
    vi.mocked(can).mockResolvedValue(false);

    const hasAccess = await hasOrganizationAccess(mockUserId, mockOrgId);
    expect(hasAccess).toBe(false);
  });

  test("isManagerOrOwner should return true for manager role", async () => {
    vi.mocked(can).mockResolvedValue(true);

    const isManager = await isManagerOrOwner(mockUserId, mockOrgId);
    expect(isManager).toBe(true);
    expect(can).toHaveBeenCalledWith({ type: "user", id: mockUserId }, "organization.manage", {
      type: "organization",
      id: mockOrgId,
    });
  });

  test("isManagerOrOwner should return true for owner role", async () => {
    vi.mocked(can).mockResolvedValue(true);

    const isOwner = await isManagerOrOwner(mockUserId, mockOrgId);
    expect(isOwner).toBe(true);
  });

  test("isManagerOrOwner should return false for member role", async () => {
    vi.mocked(can).mockResolvedValue(false);

    const isManagerOrOwnerRole = await isManagerOrOwner(mockUserId, mockOrgId);
    expect(isManagerOrOwnerRole).toBe(false);
  });

  test("isOwner should return true only for owner role", async () => {
    vi.mocked(can).mockResolvedValue(true);

    const isOwnerRole = await isOwner(mockUserId, mockOrgId);
    expect(isOwnerRole).toBe(true);
    expect(can).toHaveBeenCalledWith({ type: "user", id: mockUserId }, "organization.write", {
      type: "organization",
      id: mockOrgId,
    });
  });

  test("isOwner should return false for non-owner roles", async () => {
    vi.mocked(can).mockResolvedValue(false);

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
    vi.mocked(can).mockResolvedValue(true);

    const hasAuthority = await hasOrganizationAuthority(mockUserId, mockOrgId);
    expect(hasAuthority).toBe(true);
  });

  test("hasOrganizationAuthority should throw for non-member", async () => {
    vi.mocked(can).mockResolvedValue(false);

    await expect(hasOrganizationAuthority(mockUserId, mockOrgId)).rejects.toThrow(AuthenticationError);
  });

  test("hasOrganizationAuthority should throw for member role", async () => {
    vi.mocked(can).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(hasOrganizationAuthority(mockUserId, mockOrgId)).rejects.toThrow(AuthenticationError);
  });

  test("hasOrganizationOwnership should return true for owner", async () => {
    vi.mocked(can).mockResolvedValue(true);

    const hasOwnership = await hasOrganizationOwnership(mockUserId, mockOrgId);
    expect(hasOwnership).toBe(true);
  });

  test("hasOrganizationOwnership should throw for non-member", async () => {
    vi.mocked(can).mockResolvedValue(false);

    await expect(hasOrganizationOwnership(mockUserId, mockOrgId)).rejects.toThrow(AuthenticationError);
  });

  test("hasOrganizationOwnership should throw for non-owner roles", async () => {
    vi.mocked(can).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(hasOrganizationOwnership(mockUserId, mockOrgId)).rejects.toThrow(AuthenticationError);
  });
});
