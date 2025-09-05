import { Prisma } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { getQuotaLinkCountByQuotaId } from "./quota-link";

vi.mock("@formbricks/database", () => ({
  prisma: {
    responseQuotaLink: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("quota-link", () => {
  describe("getQuotaLinkCountByQuotaId", () => {
    const quotaId = "quota123";

    test("should return the count of quota links by quota id", async () => {
      vi.mocked(prisma.responseQuotaLink.count).mockResolvedValue(1);
      const quotaLinkCount = await getQuotaLinkCountByQuotaId(quotaId);
      expect(quotaLinkCount).toEqual(1);
    });

    test("should throw DatabaseError if PrismaClientKnownRequestError occurs", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: "P2002",
        clientVersion: "2.0.0",
      });
      vi.mocked(prisma.responseQuotaLink.count).mockRejectedValue(prismaError);
      await expect(getQuotaLinkCountByQuotaId(quotaId)).rejects.toThrow(DatabaseError);
    });

    test("should throw generic error if an unknown error occurs", async () => {
      const genericError = new Error("Test Generic Error");
      vi.mocked(prisma.responseQuotaLink.count).mockRejectedValue(genericError);
      await expect(getQuotaLinkCountByQuotaId(quotaId)).rejects.toThrow(genericError);
    });
  });
});
