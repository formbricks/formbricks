import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireV3OrganizationAccess } from "@/app/api/v3/lib/organization-access";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { getIsDashboardViewerRoleEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  MemberAttributeKeyConflictError,
  MemberAttributeKeyInUseError,
  MemberAttributeKeyLimitError,
  MemberAttributeKeyNotFoundError,
  MemberAttributeKeyTakenError,
} from "@/modules/ee/member-attributes/lib/errors";
import {
  applyMemberAttributeWrites,
  createAttributeKey,
  deleteAttributeKey,
  listAttributeKeys,
  listAttributeKeysWithUsage,
  listMemberAttributeRows,
  matchEmailsInOrganization,
  updateAttributeKey,
} from "@/modules/ee/member-attributes/lib/service";
import {
  bulkSetV3MemberAttributes,
  createV3MemberAttributeKey,
  deleteV3MemberAttributeKey,
  listV3MemberAttributeKeys,
  listV3MemberAttributes,
  updateV3MemberAttributeKey,
} from "./operations";
import { encodeMemberAttributeRowsCursor } from "./serializers";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/organization-access", () => ({ requireV3OrganizationAccess: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDashboardViewerRoleEnabled: vi.fn() }));
vi.mock("@/modules/ee/member-attributes/lib/service", () => ({
  applyMemberAttributeWrites: vi.fn(),
  createAttributeKey: vi.fn(),
  deleteAttributeKey: vi.fn(),
  getAttributeKey: vi.fn(),
  listAttributeKeys: vi.fn(),
  listAttributeKeysWithUsage: vi.fn(),
  listMemberAttributeRows: vi.fn(),
  matchEmailsInOrganization: vi.fn(),
  updateAttributeKey: vi.fn(),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));

const organizationId = "clorg00000000000000000001";
const keyId = "clkey00000000000000000001";
const base = { authentication: null, organizationId, requestId: "req_1", instance: "/api/v3/x" };
const key = {
  id: keyId,
  key: "country",
  label: "Country",
  description: null,
  createdAt: new Date("2026-11-01T10:00:00.000Z"),
  updatedAt: new Date("2026-11-02T10:00:00.000Z"),
};

const grant = () => {
  vi.mocked(requireV3OrganizationAccess).mockResolvedValue({ organizationId });
  vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(true);
};

type TJsonBody = {
  code?: string;
  details?: unknown;
  invalid_params?: { name: string; code?: string }[];
  data?: unknown;
  meta?: { limit: number; nextCursor: string | null };
};

const body = async (response: Response) => (await response.json()) as TJsonBody;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("access", () => {
  test("relays the access refusal and touches no data", async () => {
    vi.mocked(requireV3OrganizationAccess).mockResolvedValue(new Response(null, { status: 403 }));
    const response = await listV3MemberAttributeKeys(base);
    expect(response.status).toBe(403);
    expect(listAttributeKeysWithUsage).not.toHaveBeenCalled();
  });

  test("asks read of reads and write of writes", async () => {
    grant();
    vi.mocked(listAttributeKeysWithUsage).mockResolvedValue([]);
    vi.mocked(createAttributeKey).mockResolvedValue(key);
    await listV3MemberAttributeKeys(base);
    await createV3MemberAttributeKey({
      ...base,
      body: { key: "country", label: "Country", description: null },
    });
    expect(vi.mocked(requireV3OrganizationAccess).mock.calls.map((call) => call[2])).toEqual([
      "read",
      "write",
    ]);
  });

  test("answers member_attributes_plan_required without Access Control and Dashboards", async () => {
    vi.mocked(requireV3OrganizationAccess).mockResolvedValue({ organizationId });
    vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(false);
    const response = await listV3MemberAttributeKeys(base);
    expect(response.status).toBe(403);
    expect((await body(response)).code).toBe("member_attributes_plan_required");
    expect(listAttributeKeysWithUsage).not.toHaveBeenCalled();
  });
});

describe("keys", () => {
  test("lists keys with their usage", async () => {
    grant();
    vi.mocked(listAttributeKeysWithUsage).mockResolvedValue([
      { ...key, memberCount: 3, distinctValueCount: 2 },
    ]);
    const json = await body(await listV3MemberAttributeKeys(base));
    expect(json.data).toEqual([
      {
        id: keyId,
        key: "country",
        label: "Country",
        description: null,
        createdAt: "2026-11-01T10:00:00.000Z",
        updatedAt: "2026-11-02T10:00:00.000Z",
        memberCount: 3,
        distinctValueCount: 2,
      },
    ]);
  });

  test("creates a key, answers 201 with its location and audits it", async () => {
    grant();
    vi.mocked(createAttributeKey).mockResolvedValue(key);
    const auditLog = {} as TV3AuditLog;
    const response = await createV3MemberAttributeKey({
      ...base,
      body: { key: "country", label: "Country", description: null },
      auditLog,
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(
      `/api/v3/organizations/${organizationId}/member-attribute-keys/${keyId}`
    );
    expect(auditLog).toMatchObject({ organizationId, targetId: keyId, newObject: key });
  });

  test("maps a taken key to 409 and the key cap to 422 naming the limit", async () => {
    grant();
    vi.mocked(createAttributeKey).mockRejectedValueOnce(new MemberAttributeKeyTakenError("country"));
    const input = { ...base, body: { key: "country", label: "Country", description: null } };
    expect((await createV3MemberAttributeKey(input)).status).toBe(409);
    vi.mocked(createAttributeKey).mockRejectedValueOnce(new MemberAttributeKeyLimitError(50));
    const response = await createV3MemberAttributeKey(input);
    expect(response.status).toBe(422);
    expect((await body(response)).invalid_params?.[0]).toMatchObject({ name: "key", code: "limit_exceeded" });
  });

  test("passes expectedUpdatedAt through and answers 409 with the current one when stale", async () => {
    grant();
    vi.mocked(updateAttributeKey).mockRejectedValue(new MemberAttributeKeyConflictError(key.updatedAt));
    const response = await updateV3MemberAttributeKey({
      ...base,
      keyId,
      body: { label: "Land", expectedUpdatedAt: "2026-11-01T10:00:00.000Z" },
    });
    expect(vi.mocked(updateAttributeKey).mock.calls[0]).toEqual([
      organizationId,
      keyId,
      { label: "Land", description: undefined, expectedUpdatedAt: new Date("2026-11-01T10:00:00.000Z") },
    ]);
    expect(response.status).toBe(409);
    expect((await body(response)).details).toEqual({ currentUpdatedAt: "2026-11-02T10:00:00.000Z" });
  });

  test("answers 403 for a key the organization does not have", async () => {
    grant();
    vi.mocked(updateAttributeKey).mockRejectedValue(new MemberAttributeKeyNotFoundError());
    const response = await updateV3MemberAttributeKey({
      ...base,
      keyId,
      body: { label: "Land", expectedUpdatedAt: "2026-11-01T10:00:00.000Z" },
    });
    expect(response.status).toBe(403);
  });

  test("refuses to delete a key Dashboard Viewer access uses, naming the datasets", async () => {
    grant();
    vi.mocked(deleteAttributeKey).mockRejectedValue(
      new MemberAttributeKeyInUseError([{ id: "clds1", name: "Support tickets" }], 1)
    );
    const response = await deleteV3MemberAttributeKey({ ...base, keyId });
    expect(response.status).toBe(409);
    const json = await body(response);
    expect(json.code).toBe("member_attribute_key_in_use");
    expect(json.details).toEqual({ datasets: [{ id: "clds1", name: "Support tickets" }], datasetCount: 1 });
  });
});

describe("listV3MemberAttributes", () => {
  test("round-trips its cursor and refuses one it did not issue", async () => {
    grant();
    vi.mocked(listMemberAttributeRows).mockResolvedValue({
      rows: [],
      nextCursor: { phase: "invite", id: "inv_1" },
    });
    const first = await body(await listV3MemberAttributes({ ...base, query: {} }));
    expect(first.meta).toEqual({
      limit: 50,
      nextCursor: encodeMemberAttributeRowsCursor({ phase: "invite", id: "inv_1" }),
    });

    await listV3MemberAttributes({
      ...base,
      query: { cursor: first.meta?.nextCursor ?? undefined, limit: 10 },
    });
    expect(vi.mocked(listMemberAttributeRows).mock.calls[1][1]).toEqual({
      limit: 10,
      cursor: { phase: "invite", id: "inv_1" },
      search: undefined,
    });

    expect((await listV3MemberAttributes({ ...base, query: { cursor: "not-a-cursor" } })).status).toBe(400);
  });
});

describe("bulkSetV3MemberAttributes", () => {
  test("writes matched rows, reports the rest and audits outcomes without values", async () => {
    grant();
    vi.mocked(listAttributeKeys).mockResolvedValue([key]);
    vi.mocked(matchEmailsInOrganization).mockResolvedValue(
      new Map([
        ["anna@example.com", { target: "member" as const, userId: "user_anna", email: "anna@example.com" }],
      ])
    );
    const auditLog = {} as TV3AuditLog;
    const response = await bulkSetV3MemberAttributes({
      ...base,
      auditLog,
      body: {
        rows: [
          { email: "Anna@example.com", attributes: { country: ["Sweden"] } },
          { email: "new@example.com", attributes: { country: ["Norway"] } },
          { email: "anna@example.com", attributes: { contry: ["Norway"] } },
        ],
      },
    });
    const json = await body(response);
    expect((json.data as { summary: unknown }).summary).toEqual({
      updatedMembers: 1,
      updatedInvites: 0,
      unknownEmails: 1,
      invalid: 1,
    });
    expect(vi.mocked(applyMemberAttributeWrites).mock.calls[0]).toEqual([
      organizationId,
      [{ target: "member", userId: "user_anna", valuesByKeyId: new Map([[keyId, ["Sweden"]]]) }],
    ]);
    expect(JSON.stringify(auditLog.newObject)).not.toContain("Sweden");
  });
});
