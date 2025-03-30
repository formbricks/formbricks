import { describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getRoles } from "../roles";

// Mock prisma with a $queryRaw function
vi.mock("@formbricks/database", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

describe("getRoles", () => {
  it("returns roles on success", async () => {
    (prisma.$queryRaw as any).mockResolvedValueOnce([{ unnest: "ADMIN" }, { unnest: "MEMBER" }]);

    const result = await getRoles();
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.data).toEqual(["ADMIN", "MEMBER"]);
    }
  });

  it("returns error if no results are found", async () => {
    (prisma.$queryRaw as any).mockResolvedValueOnce(null);

    const result = await getRoles();
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("internal_server_error");
    }
  });

  it("returns error on exception", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("Test DB error"));

    const result = await getRoles();
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.type).toBe("internal_server_error");
    }
  });
});
