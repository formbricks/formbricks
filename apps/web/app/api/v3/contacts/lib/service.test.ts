import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  buildContactWhere,
  countContactRows,
  createContactWithUserId,
  listContactRows,
  removeContactAttributes,
} from "./service";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    contactAttribute: { deleteMany: vi.fn() },
  },
}));

const workspaceId = "clxx1234567890123456789012";
const row = (id: string, createdAt: string) => ({ id, createdAt: new Date(createdAt) });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("buildContactWhere", () => {
  test("always scopes to the workspace, and to nothing wider when there are no filters", () => {
    expect(buildContactWhere({ workspaceId })).toEqual({ workspaceId });
  });

  test("a userId filter reads the workspace's own userId key", () => {
    expect(buildContactWhere({ workspaceId, userId: "u_1" })).toEqual({
      workspaceId,
      AND: [{ attributes: { some: { attributeKey: { key: "userId", workspaceId }, value: "u_1" } } }],
    });
  });

  test("an attribute filter is an exact match on that workspace's key, ANDed with the userId", () => {
    const where = buildContactWhere({
      workspaceId,
      userId: "u_1",
      attributeKey: "plan",
      attributeValue: "pro",
    });

    expect(where.workspaceId).toBe(workspaceId);
    expect(where.AND).toEqual([
      { attributes: { some: { attributeKey: { key: "userId", workspaceId }, value: "u_1" } } },
      { attributes: { some: { attributeKey: { key: "plan", workspaceId }, value: "pro" } } },
    ]);
  });

  test("an attribute key without a value adds no condition rather than matching on undefined", () => {
    expect(buildContactWhere({ workspaceId, attributeKey: "plan" })).toEqual({ workspaceId });
  });
});

describe("listContactRows", () => {
  test("reads one row beyond the limit, newest first with the id as tiebreak", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([]);

    await listContactRows({ filters: { workspaceId }, limit: 20, cursor: null, fingerprint: "fp" });

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 21,
      })
    );
  });

  test("hands back a cursor only when a further row exists, and the page excludes that row", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([
      row("c3", "2026-03-03T00:00:00.000Z"),
      row("c2", "2026-03-02T00:00:00.000Z"),
      row("c1", "2026-03-01T00:00:00.000Z"),
    ] as never);

    const more = await listContactRows({
      filters: { workspaceId },
      limit: 2,
      cursor: null,
      fingerprint: "fp",
    });
    expect(more.page.map((contact) => contact.id)).toEqual(["c3", "c2"]);
    expect(more.nextCursor).not.toBeNull();

    vi.mocked(prisma.contact.findMany).mockResolvedValue([row("c1", "2026-03-01T00:00:00.000Z")] as never);
    const last = await listContactRows({
      filters: { workspaceId },
      limit: 2,
      cursor: null,
      fingerprint: "fp",
    });
    expect(last.nextCursor).toBeNull();
  });

  test("a cursor adds a keyset condition next to, never instead of, the workspace scope", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([]);

    await listContactRows({
      filters: { workspaceId },
      limit: 20,
      cursor: { value: "2026-03-02T00:00:00.000Z", id: "c2" },
      fingerprint: "fp",
    });

    const createdAt = new Date("2026-03-02T00:00:00.000Z");
    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ workspaceId }, { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: "c2" } }] }],
        },
      })
    );
  });
});

describe("the other queries", () => {
  test("count uses the same scoped where", async () => {
    vi.mocked(prisma.contact.count).mockResolvedValue(4);

    expect(await countContactRows({ workspaceId, attributeKey: "plan", attributeValue: "pro" })).toBe(4);
    expect(prisma.contact.count).toHaveBeenCalledWith({
      where: buildContactWhere({ workspaceId, attributeKey: "plan", attributeValue: "pro" }),
    });
  });

  test("a new contact is connected to the workspace's own userId key", async () => {
    vi.mocked(prisma.contact.create).mockResolvedValue({ id: "c1" } as never);

    await createContactWithUserId(workspaceId, "u_1");

    expect(prisma.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          workspace: { connect: { id: workspaceId } },
          attributes: {
            create: [
              {
                attributeKey: { connect: { key_workspaceId: { key: "userId", workspaceId } } },
                value: "u_1",
              },
            ],
          },
        },
      })
    );
  });

  test("removing attributes is limited to one contact and one workspace's keys", async () => {
    await removeContactAttributes("c1", workspaceId, ["legacy"]);

    expect(prisma.contactAttribute.deleteMany).toHaveBeenCalledWith({
      where: { contactId: "c1", attributeKey: { workspaceId, key: { in: ["legacy"] } } },
    });
  });
});
