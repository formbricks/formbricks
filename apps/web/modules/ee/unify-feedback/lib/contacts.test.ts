import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getContactIdsByUserIds } from "./contacts";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttribute: {
      findMany: vi.fn(),
    },
  },
}));

const workspaceId = "ws-1";

describe("getContactIdsByUserIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns an empty map and skips the query when no userIds are given", async () => {
    const result = await getContactIdsByUserIds(workspaceId, []);

    expect(result).toEqual({});
    expect(prisma.contactAttribute.findMany).not.toHaveBeenCalled();
  });

  test("returns an empty map and skips the query when all userIds are falsy", async () => {
    const result = await getContactIdsByUserIds(workspaceId, ["", "", ""]);

    expect(result).toEqual({});
    expect(prisma.contactAttribute.findMany).not.toHaveBeenCalled();
  });

  test("dedupes and drops empty userIds before querying, scoped to the workspace's userId key", async () => {
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);

    await getContactIdsByUserIds(workspaceId, ["u1", "u1", "", "u2"]);

    expect(prisma.contactAttribute.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.contactAttribute.findMany).toHaveBeenCalledWith({
      where: {
        attributeKey: { key: "userId", workspaceId },
        value: { in: ["u1", "u2"] },
      },
      select: { value: true, contactId: true },
    });
  });

  test("maps each matched userId value to its contact id", async () => {
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([
      { value: "u1", contactId: "c1" },
      { value: "u2", contactId: "c2" },
    ] as never);

    const result = await getContactIdsByUserIds(workspaceId, ["u1", "u2"]);

    expect(result).toEqual({ u1: "c1", u2: "c2" });
  });

  test("returns an empty map when no contacts match the given userIds", async () => {
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);

    const result = await getContactIdsByUserIds(workspaceId, ["missing"]);

    expect(result).toEqual({});
  });

  test("omits userIds with no matching contact from the result", async () => {
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([
      { value: "u1", contactId: "c1" },
    ] as never);

    const result = await getContactIdsByUserIds(workspaceId, ["u1", "u2"]);

    expect(result).toEqual({ u1: "c1" });
    expect("u2" in result).toBe(false);
  });

  test("last write wins if the same userId value maps to multiple contacts", async () => {
    // The userId attribute is expected to be unique per workspace, but guard the documented
    // Object.fromEntries behaviour so a duplicate never silently merges into an ambiguous map.
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([
      { value: "u1", contactId: "c1" },
      { value: "u1", contactId: "c2" },
    ] as never);

    const result = await getContactIdsByUserIds(workspaceId, ["u1"]);

    expect(result).toEqual({ u1: "c2" });
  });
});
