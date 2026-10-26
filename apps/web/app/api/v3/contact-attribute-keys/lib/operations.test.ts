import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { listV3ContactAttributeKeys } from "./operations";

vi.mock("server-only", () => ({}));

vi.mock("@/app/api/v3/lib/auth", () => ({
  requireV3WorkspaceAccess: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/lib/contact-attribute-keys", () => ({
  getContactAttributeKeys: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

const workspaceId = "clxx1234567890123456789012";

const attributeKey = {
  id: "clak1234567890123456789012",
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T10:00:00.000Z"),
  isUnique: false,
  key: "plan",
  name: "Plan",
  description: "Subscription plan",
  type: "custom",
  dataType: "string",
  workspaceId,
} as unknown as Awaited<ReturnType<typeof getContactAttributeKeys>>[number];

const buildParams = (query: Record<string, string | string[]> = {}) => {
  const searchParams = new URLSearchParams({ workspaceId });
  for (const [name, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) searchParams.append(name, item);
  }
  return {
    searchParams,
    authentication: null,
    requestId: "req_1",
    instance: "/api/v3/contact-attribute-keys",
  };
};
const params = buildParams();
const accessGranted = { workspaceId, organizationId: "org_1" } as Awaited<
  ReturnType<typeof requireV3WorkspaceAccess>
>;

describe("listV3ContactAttributeKeys", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getIsContactsEnabled).mockResolvedValue(true);
  });

  test("returns the public attribute-key shape for an authorized workspace", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(accessGranted);
    vi.mocked(getContactAttributeKeys).mockResolvedValue([attributeKey]);

    const response = await listV3ContactAttributeKeys(params);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [
        {
          id: "clak1234567890123456789012",
          key: "plan",
          name: "Plan",
          description: "Subscription plan",
          type: "custom",
          dataType: "string",
          isUnique: false,
          createdAt: "2026-04-21T10:00:00.000Z",
          updatedAt: "2026-04-21T10:00:00.000Z",
        },
      ],
      meta: { limit: 50, nextCursor: null, totalCount: null },
    });
    expect(getContactAttributeKeys).toHaveBeenCalledWith(workspaceId);
  });

  test("paginates with limit + cursor (nextCursor points to the next page)", async () => {
    const second = {
      ...attributeKey,
      id: "clbk1234567890123456789012",
      key: "role",
    } as typeof attributeKey;
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(accessGranted);
    vi.mocked(getContactAttributeKeys).mockResolvedValue([attributeKey, second]);

    const page1 = await listV3ContactAttributeKeys(buildParams({ limit: "1" }));
    const body1 = await page1.json();
    expect(body1.data).toHaveLength(1);
    expect(body1.data[0].id).toBe("clak1234567890123456789012");
    expect(typeof body1.meta.nextCursor).toBe("string");

    const page2 = await listV3ContactAttributeKeys(
      buildParams({ limit: "1", cursor: body1.meta.nextCursor })
    );
    const body2 = await page2.json();
    expect(body2.data).toHaveLength(1);
    expect(body2.data[0].id).toBe("clbk1234567890123456789012");
    expect(body2.meta.nextCursor).toBeNull();
  });

  test("returns 400 on a malformed cursor", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(accessGranted);
    vi.mocked(getContactAttributeKeys).mockResolvedValue([attributeKey]);

    const response = await listV3ContactAttributeKeys(buildParams({ cursor: "%%%%" }));

    expect(response.status).toBe(400);
  });

  test("returns the auth response and skips fetching when access is denied", async () => {
    const denied = new Response("forbidden", { status: 403 });
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(denied);

    const response = await listV3ContactAttributeKeys(params);

    expect(response).toBe(denied);
    expect(getContactAttributeKeys).not.toHaveBeenCalled();
  });

  test("returns 403 when the contacts feature is not enabled for the organization", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(accessGranted);
    vi.mocked(getIsContactsEnabled).mockResolvedValue(false);

    const response = await listV3ContactAttributeKeys(params);

    expect(response.status).toBe(403);
    expect(getContactAttributeKeys).not.toHaveBeenCalled();
  });

  test("returns 500 when fetching attribute keys fails", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(accessGranted);
    vi.mocked(getContactAttributeKeys).mockRejectedValue(new DatabaseError("boom"));

    const response = await listV3ContactAttributeKeys(params);

    expect(response.status).toBe(500);
  });
});

describe("listV3ContactAttributeKeys — search, filters, sort, totals", () => {
  const makeKey = (overrides: Record<string, unknown>) =>
    ({ ...attributeKey, ...overrides }) as unknown as typeof attributeKey;

  const keys = [
    makeKey({
      id: "clak0000000000000000000001",
      key: "email",
      name: "Email",
      description: null,
      type: "default",
      dataType: "string",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    }),
    makeKey({
      id: "clak0000000000000000000002",
      key: "seats",
      name: "Seats",
      description: "Paid seats",
      type: "custom",
      dataType: "number",
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    }),
    makeKey({
      id: "clak0000000000000000000003",
      key: "renewal",
      name: null,
      description: "Next renewal date",
      type: "custom",
      dataType: "date",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    }),
  ];

  const ids = async (response: Response): Promise<string[]> =>
    ((await response.json()) as { data: { id: string }[] }).data.map((item) => item.id);

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getIsContactsEnabled).mockResolvedValue(true);
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(accessGranted);
    vi.mocked(getContactAttributeKeys).mockResolvedValue(keys);
  });

  test("filters by dataType (repeated and comma-separated) and type", async () => {
    expect(
      await ids(await listV3ContactAttributeKeys(buildParams({ "filter[dataType][in]": ["number", "date"] })))
    ).toEqual(["clak0000000000000000000002", "clak0000000000000000000003"]);
    expect(
      await ids(await listV3ContactAttributeKeys(buildParams({ "filter[dataType][in]": "string,date" })))
    ).toEqual(["clak0000000000000000000001", "clak0000000000000000000003"]);
    expect(
      await ids(await listV3ContactAttributeKeys(buildParams({ "filter[type][in]": "default" })))
    ).toEqual(["clak0000000000000000000001"]);
  });

  test("rejects an unknown dataType or type value with 400", async () => {
    const response = await listV3ContactAttributeKeys(buildParams({ "filter[dataType][in]": "boolean" }));
    expect(response.status).toBe(400);
    expect(getContactAttributeKeys).not.toHaveBeenCalled();
  });

  test("searches key, name and description case-insensitively", async () => {
    expect(await ids(await listV3ContactAttributeKeys(buildParams({ search: "EMA" })))).toEqual([
      "clak0000000000000000000001",
    ]);
    expect(await ids(await listV3ContactAttributeKeys(buildParams({ search: "renewal DATE" })))).toEqual([
      "clak0000000000000000000003",
    ]);
  });

  test("sorts by name (falling back to key), createdAt and updatedAt", async () => {
    expect(await ids(await listV3ContactAttributeKeys(buildParams({ sortBy: "name" })))).toEqual([
      "clak0000000000000000000001",
      "clak0000000000000000000003",
      "clak0000000000000000000002",
    ]);
    expect(await ids(await listV3ContactAttributeKeys(buildParams({ sortBy: "-createdAt" })))).toEqual([
      "clak0000000000000000000003",
      "clak0000000000000000000002",
      "clak0000000000000000000001",
    ]);
    expect(await ids(await listV3ContactAttributeKeys(buildParams({ sortBy: "updatedAt" })))).toEqual([
      "clak0000000000000000000002",
      "clak0000000000000000000003",
      "clak0000000000000000000001",
    ]);
  });

  test("rejects an unsupported sort or an unknown query parameter with 400", async () => {
    expect((await listV3ContactAttributeKeys(buildParams({ sortBy: "key" }))).status).toBe(400);
    expect((await listV3ContactAttributeKeys(buildParams({ foo: "bar" }))).status).toBe(400);
  });

  test("totalCount is null by default and the filtered total when requested", async () => {
    const without = await (await listV3ContactAttributeKeys(buildParams({ limit: "1" }))).json();
    expect(without.meta.totalCount).toBeNull();

    const withTotal = await (
      await listV3ContactAttributeKeys(
        buildParams({ limit: "1", includeTotalCount: "true", "filter[type][in]": "custom" })
      )
    ).json();
    expect(withTotal.meta.totalCount).toBe(2);
    expect(withTotal.data).toHaveLength(1);
  });

  test("walks every page of a sorted list without skipping or repeating", async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const query: Record<string, string> = { sortBy: "-updatedAt", limit: "1" };
      if (cursor) query.cursor = cursor;
      const body = await (await listV3ContactAttributeKeys(buildParams(query))).json();
      seen.push(...body.data.map((item: { id: string }) => item.id));
      cursor = body.meta.nextCursor;
    } while (cursor);

    expect(seen).toEqual([
      "clak0000000000000000000001",
      "clak0000000000000000000003",
      "clak0000000000000000000002",
    ]);
  });

  test("pages past a name longer than a cursor can carry", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue([
      makeKey({ ...keys[0], name: `A${"a".repeat(2000)}` }),
      keys[1],
      keys[2],
    ]);

    const page1 = await (
      await listV3ContactAttributeKeys(buildParams({ sortBy: "name", limit: "1" }))
    ).json();
    const page2 = await listV3ContactAttributeKeys(
      buildParams({ sortBy: "name", limit: "1", cursor: page1.meta.nextCursor })
    );

    expect(page1.data[0].id).toBe("clak0000000000000000000001");
    expect(page2.status).toBe(200);
    expect(await ids(page2)).toEqual(["clak0000000000000000000003"]);
  });

  test("rejects a cursor reused under a different sort with 400", async () => {
    const page1 = await (
      await listV3ContactAttributeKeys(buildParams({ sortBy: "name", limit: "1" }))
    ).json();

    const response = await listV3ContactAttributeKeys(
      buildParams({ sortBy: "-createdAt", limit: "1", cursor: page1.meta.nextCursor })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.invalid_params).toEqual([
      { name: "cursor", reason: "The cursor does not match the requested sort order." },
    ]);
  });

  test("still honours the original bare-id cursor on the default order", async () => {
    const legacyCursor = Buffer.from("clak0000000000000000000001", "utf8").toString("base64url");

    expect(await ids(await listV3ContactAttributeKeys(buildParams({ cursor: legacyCursor })))).toEqual([
      "clak0000000000000000000002",
      "clak0000000000000000000003",
    ]);
    // …but not under an explicit sort, where the position needs a sort value.
    expect(
      (await listV3ContactAttributeKeys(buildParams({ sortBy: "name", cursor: legacyCursor }))).status
    ).toBe(400);
  });
});
