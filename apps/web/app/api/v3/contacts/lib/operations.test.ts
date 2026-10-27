import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { listV3Contacts } from "./operations";

vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttributeKey: { findMany: vi.fn() },
    contact: { findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn() }));

const workspaceId = "clws0000000000000000000001";
const accessGranted = { workspaceId, organizationId: "clorg000000000000000000001" } as Awaited<
  ReturnType<typeof requireV3WorkspaceAccess>
>;

const contactRow = (id: string, createdAt: string) => ({
  id,
  createdAt: new Date(createdAt),
  updatedAt: new Date(createdAt),
  attributes: [
    {
      value: "ada@example.com",
      valueNumber: null,
      valueDate: null,
      attributeKey: { key: "email", name: "Email", dataType: "string" },
    },
    {
      value: "12",
      valueNumber: 12,
      valueDate: null,
      attributeKey: { key: "seats", name: "Seats", dataType: "number" },
    },
  ],
});

const call = (entries: [string, string][] = []) =>
  listV3Contacts({
    searchParams: new URLSearchParams([["workspaceId", workspaceId], ...entries]),
    authentication: null,
    requestId: "req_1",
    instance: "/api/v3/contacts",
  });

describe("listV3Contacts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(accessGranted);
    vi.mocked(getIsContactsEnabled).mockResolvedValue(true);
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([
      { id: "clak0000000000000000000001", key: "seats", dataType: "number" },
    ] as never);
    vi.mocked(prisma.contact.count).mockResolvedValue(3);
  });

  test("returns the page, the total and a cursor; page and count run with the same filter", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([
      contactRow("clct0000000000000000000003", "2026-03-01T00:00:00.000Z"),
      contactRow("clct0000000000000000000002", "2026-02-01T00:00:00.000Z"),
    ] as never);

    const response = await call([
      ["limit", "1"],
      ["includeTotalCount", "true"],
      ["filter[attribute.seats][greaterThan]", "10"],
    ]);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([
      {
        id: "clct0000000000000000000003",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
        userId: null,
        email: "ada@example.com",
        firstName: null,
        lastName: null,
        attributes: [
          { key: "email", name: "Email", dataType: "string", value: "ada@example.com" },
          { key: "seats", name: "Seats", dataType: "number", value: "12" },
        ],
      },
    ]);
    expect(body.meta).toEqual({ limit: 1, nextCursor: expect.any(String), totalCount: 3 });

    const findManyArgs = vi.mocked(prisma.contact.findMany).mock.calls[0][0];
    expect(findManyArgs?.take).toBe(2);
    expect(findManyArgs?.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    // The attribute keys are looked up inside the authorized workspace only.
    expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith({
      where: { workspaceId, key: { in: ["seats"] } },
      select: { id: true, key: true, dataType: true },
    });
    const countWhere = vi.mocked(prisma.contact.count).mock.calls[0][0]?.where;
    expect(countWhere).toEqual({
      workspaceId,
      AND: [
        { attributes: { some: { attributeKeyId: "clak0000000000000000000001", valueNumber: { gt: 10 } } } },
      ],
    });
    expect(findManyArgs?.where).toEqual(countWhere);
  });

  test("the next page adds the keyset condition to the page query only", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([
      contactRow("clct0000000000000000000003", "2026-03-01T00:00:00.000Z"),
      contactRow("clct0000000000000000000002", "2026-02-01T00:00:00.000Z"),
    ] as never);
    const first = await (await call([["limit", "1"]])).json();

    vi.mocked(prisma.contact.findMany).mockClear();
    vi.mocked(prisma.contact.findMany).mockResolvedValue([] as never);
    const second = await call([
      ["limit", "1"],
      ["cursor", first.meta.nextCursor],
    ]);

    expect(second.status).toBe(200);
    const where = vi.mocked(prisma.contact.findMany).mock.calls[0][0]?.where;
    const at = new Date("2026-03-01T00:00:00.000Z");
    expect(where).toEqual({
      AND: [
        { workspaceId },
        { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: "clct0000000000000000000003" } }] },
      ],
    });
  });

  test("a cursor reused with a different filter or sort is a 400", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([
      contactRow("clct0000000000000000000003", "2026-03-01T00:00:00.000Z"),
      contactRow("clct0000000000000000000002", "2026-02-01T00:00:00.000Z"),
    ] as never);
    const first = await (await call([["limit", "1"]])).json();

    const otherFilter = await call([
      ["cursor", first.meta.nextCursor],
      ["search", "ada"],
    ]);
    expect(otherFilter.status).toBe(400);
    expect((await otherFilter.json()).invalid_params[0].name).toBe("cursor");

    const otherSort = await call([
      ["cursor", first.meta.nextCursor],
      ["sortBy", "createdAt"],
    ]);
    expect(otherSort.status).toBe(400);
  });

  test.each([
    ["includeTotalCount=false", [["includeTotalCount", "false"]]],
    ["includeTotalCount is omitted", []],
  ] as [string, [string, string][]][])("skips the count when %s", async (_label, entries) => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([] as never);

    const body = await (await call(entries)).json();

    expect(body.meta).toEqual({ limit: 50, nextCursor: null, totalCount: null });
    expect(prisma.contact.count).not.toHaveBeenCalled();
  });

  test("an unknown attribute key or a wrong operator for its type is a 400 before any contact query", async () => {
    expect((await call([["filter[attribute.plan][equals]", "x"]])).status).toBe(400);
    expect((await call([["filter[attribute.seats][contains]", "1"]])).status).toBe(400);
    expect(prisma.contact.findMany).not.toHaveBeenCalled();
  });

  test("a syntax error is a 400 before authorization", async () => {
    const response = await call([["unknown", "1"]]);
    expect(response.status).toBe(400);
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
  });

  test("returns the auth response untouched when access is denied", async () => {
    const denied = new Response(null, { status: 403 });
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(denied);

    expect(await call()).toBe(denied);
    expect(prisma.contact.findMany).not.toHaveBeenCalled();
  });

  test("403 when the organization is not entitled to Contacts", async () => {
    vi.mocked(getIsContactsEnabled).mockResolvedValue(false);

    expect((await call()).status).toBe(403);
    expect(prisma.contact.findMany).not.toHaveBeenCalled();
  });

  test("500 when the query fails", async () => {
    vi.mocked(prisma.contact.findMany).mockRejectedValue(new Error("boom"));
    expect((await call()).status).toBe(500);
  });
});
