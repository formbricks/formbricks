import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { buildAttributeValuesQuery, listV3ContactAttributeValues } from "./operations";
import { ZV3ContactAttributeValuesQuery } from "./schemas";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttributeKey: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn() }));

const workspaceId = "clws0000000000000000000001";
const attributeKeyId = "clak0000000000000000000001";

const call = (query: Record<string, string>) =>
  listV3ContactAttributeValues({
    query: ZV3ContactAttributeValuesQuery.parse({ workspaceId, ...query }),
    authentication: null,
    requestId: "req_1",
    instance: "/api/v3/contacts/attribute-values",
  });

describe("buildAttributeValuesQuery", () => {
  test("is a DISTINCT, ordered query bounded by LIMIT at the database", () => {
    const sql = buildAttributeValuesQuery({ attributeKeyId, limit: 25 });
    // Placeholder style differs between the real and the mocked Prisma (`$1` vs `?`); normalise it.
    const text = sql.sql.replaceAll(/\s+/g, " ").replaceAll(/\$\d+/g, "?");

    expect(text).toContain('SELECT DISTINCT "value" FROM "ContactAttribute"');
    expect(text).toContain('WHERE "attributeKeyId" = ?');
    expect(text).toContain(`AND "value" <> ''`);
    expect(text).toContain('ORDER BY "value" ASC LIMIT ?');
    expect(sql.values).toEqual([attributeKeyId, 25]);
  });

  test("adds an escaped case-insensitive contains when searching", () => {
    const sql = buildAttributeValuesQuery({ attributeKeyId, search: "50%_off", limit: 10 });

    expect(sql.sql.replaceAll(/\s+/g, " ").replaceAll(/\$\d+/g, "?")).toContain('AND "value" ILIKE ?');
    expect(sql.values).toEqual([attributeKeyId, String.raw`%50\%\_off%`, 10]);
  });
});

describe("ZV3ContactAttributeValuesQuery", () => {
  test("defaults the limit to 50 and caps it at 100", () => {
    expect(ZV3ContactAttributeValuesQuery.parse({ workspaceId, key: "plan" }).limit).toBe(50);
    expect(ZV3ContactAttributeValuesQuery.safeParse({ workspaceId, key: "plan", limit: "101" }).success).toBe(
      false
    );
  });

  test("rejects unknown parameters and a missing key", () => {
    expect(ZV3ContactAttributeValuesQuery.safeParse({ workspaceId, key: "plan", foo: "1" }).success).toBe(
      false
    );
    expect(ZV3ContactAttributeValuesQuery.safeParse({ workspaceId }).success).toBe(false);
  });
});

describe("listV3ContactAttributeValues", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({
      workspaceId,
      organizationId: "clorg000000000000000000001",
    } as Awaited<ReturnType<typeof requireV3WorkspaceAccess>>);
    vi.mocked(getIsContactsEnabled).mockResolvedValue(true);
  });

  test("resolves the key inside the workspace and returns the bounded values", async () => {
    vi.mocked(prisma.contactAttributeKey.findUnique).mockResolvedValue({ id: attributeKeyId } as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ value: "Enterprise" }, { value: "Pro" }] as never);

    const response = await call({ key: "plan", limit: "2" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ value: "Enterprise" }, { value: "Pro" }] });
    expect(prisma.contactAttributeKey.findUnique).toHaveBeenCalledWith({
      where: { key_workspaceId: { key: "plan", workspaceId } },
      select: { id: true },
    });
    const [sql] = vi.mocked(prisma.$queryRaw).mock.calls[0] as unknown as [{ values: unknown[] }];
    expect(sql.values).toEqual([attributeKeyId, 2]);
  });

  test("an unknown key is a 400 naming key", async () => {
    vi.mocked(prisma.contactAttributeKey.findUnique).mockResolvedValue(null);

    const response = await call({ key: "nope" });

    expect(response.status).toBe(400);
    expect((await response.json()).invalid_params).toEqual([
      { name: "key", reason: 'Unknown attribute key "nope".' },
    ]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test("403 without the Contacts entitlement", async () => {
    vi.mocked(getIsContactsEnabled).mockResolvedValue(false);

    expect((await call({ key: "plan" })).status).toBe(403);
    expect(prisma.contactAttributeKey.findUnique).not.toHaveBeenCalled();
  });
});
