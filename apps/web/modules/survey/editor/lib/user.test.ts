import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TUserLocale } from "@formbricks/types/user";
import { getUserEmail, getUserLocale } from "./user";

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe("getUserEmail", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should return user email if user is found", async () => {
    const mockUser = { id: "test-user-id", email: "test@example.com" };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

    const email = await getUserEmail("test-user-id");
    expect(email).toBe("test@example.com");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "test-user-id" },
      select: { email: true },
    });
  });

  test("should return null if user is not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const email = await getUserEmail("non-existent-user-id");
    expect(email).toBeNull();
  });

  test("should throw DatabaseError if PrismaClientKnownRequestError occurs", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
      code: "P2001",
      clientVersion: "2.0.0",
      meta: { target: "" }, // meta is required by the type
    });
    vi.mocked(prisma.user.findUnique).mockRejectedValue(prismaError);

    await expect(getUserEmail("test-user-id")).rejects.toThrow(DatabaseError);
  });

  test("should re-throw other errors", async () => {
    const genericError = new Error("Generic Error");
    vi.mocked(prisma.user.findUnique).mockRejectedValue(genericError);

    await expect(getUserEmail("test-user-id")).rejects.toThrow("Generic Error");
  });
});

describe("getUserLocale", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should return user locale if user is found", async () => {
    const mockUser = { id: "test-user-id", locale: "en" as TUserLocale };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

    const locale = await getUserLocale("test-user-id");
    expect(locale).toBe("en");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "test-user-id" },
      select: { locale: true },
    });
  });

  test("should return undefined if user is not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const locale = await getUserLocale("non-existent-user-id");
    expect(locale).toBeUndefined();
  });

  test("should throw DatabaseError if PrismaClientKnownRequestError occurs", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
      code: "P2001",
      clientVersion: "2.0.0",
    });
    vi.mocked(prisma.user.findUnique).mockRejectedValue(prismaError);

    await expect(getUserLocale("test-user-id")).rejects.toThrow(DatabaseError);
  });

  test("should re-throw other errors", async () => {
    const genericError = new Error("Generic Error");
    vi.mocked(prisma.user.findUnique).mockRejectedValue(genericError);

    await expect(getUserLocale("test-user-id")).rejects.toThrow("Generic Error");
  });
});
