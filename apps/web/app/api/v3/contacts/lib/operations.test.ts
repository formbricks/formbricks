import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { computeFilterFingerprint, encodeKeysetCursor } from "@/app/api/v3/lib/keyset-cursor";
import { formatAttributeMessage, updateAttributes } from "@/modules/ee/contacts/lib/attributes";
import { deleteContact } from "@/modules/ee/contacts/lib/contacts";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  countV3Contacts,
  deleteV3Contact,
  getV3Contact,
  listV3Contacts,
  updateV3Contact,
  upsertV3Contact,
} from "./operations";
import {
  CONTACT_LIST_KIND,
  CONTACT_LIST_SORT,
  countContactRows,
  createContactWithUserId,
  findContactIdByUserId,
  getContactRow,
  listContactRows,
  removeContactAttributes,
} from "./service";

vi.mock("server-only", () => ({}));
// `vitestSetup.ts` mocks `createHash` to a constant, which would make every cursor fingerprint equal and
// the filter binding below a tautology. The real implementation is what is under test.
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn() }));
vi.mock("@/modules/ee/contacts/lib/attributes", () => ({
  updateAttributes: vi.fn(),
  formatAttributeMessage: vi.fn((message: { code: string }) => `formatted:${message.code}`),
}));
vi.mock("@/modules/ee/contacts/lib/contacts", () => ({ deleteContact: vi.fn() }));
vi.mock("./service", () => ({
  CONTACT_LIST_KIND: "contacts.list",
  CONTACT_LIST_SORT: "-createdAt",
  listContactRows: vi.fn(),
  countContactRows: vi.fn(),
  getContactRow: vi.fn(),
  findContactIdByUserId: vi.fn(),
  createContactWithUserId: vi.fn(),
  removeContactAttributes: vi.fn(),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const workspaceId = "clxx1234567890123456789012";
const organizationId = "clzz1234567890123456789012";
const contactId = "clco1234567890123456789012";

const row = {
  id: contactId,
  workspaceId,
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T11:00:00.000Z"),
  attributes: [
    {
      value: "u_1",
      valueNumber: null,
      valueDate: null,
      attributeKey: { key: "userId", name: "User Id", dataType: "string" as const },
    },
    {
      value: "42",
      valueNumber: 42,
      valueDate: null,
      attributeKey: { key: "age", name: "Age", dataType: "number" as const },
    },
  ],
};

const base = { authentication: null, requestId: "req_1", instance: "/api/v3/contacts" };

const grantAccess = () =>
  vi
    .mocked(requireV3WorkspaceAccess)
    .mockResolvedValue({ workspaceId, organizationId } as Awaited<
      ReturnType<typeof requireV3WorkspaceAccess>
    >);

const NOT_ENABLED = "The contacts feature is not enabled for this organization.";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(formatAttributeMessage).mockImplementation((message) => `formatted:${message.code}`);
  vi.mocked(getIsContactsEnabled).mockResolvedValue(true);
  grantAccess();
});

describe("contacts entitlement and workspace access, on every operation", () => {
  const calls: [string, () => Promise<Response>][] = [
    ["list", () => listV3Contacts({ ...base, query: { workspaceId, limit: 20 } })],
    ["count", () => countV3Contacts({ ...base, query: { workspaceId } })],
    ["get", () => getV3Contact({ ...base, contactId })],
    ["upsert", () => upsertV3Contact({ ...base, body: { workspaceId, userId: "u_1" } })],
    ["update", () => updateV3Contact({ ...base, contactId, body: { attributes: { plan: "pro" } } })],
    ["delete", () => deleteV3Contact({ ...base, contactId })],
  ];

  const touchedData = () => [
    listContactRows,
    countContactRows,
    createContactWithUserId,
    findContactIdByUserId,
    updateAttributes,
    removeContactAttributes,
    deleteContact,
  ];

  test.each(calls)("%s answers the entitlement refusal without touching any contact", async (_name, call) => {
    vi.mocked(getContactRow).mockResolvedValue(row);
    vi.mocked(getIsContactsEnabled).mockResolvedValue(false);

    const response = await call();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ code: "forbidden", detail: NOT_ENABLED });
    expect(getIsContactsEnabled).toHaveBeenCalledWith(organizationId);
    for (const fn of touchedData()) expect(fn).not.toHaveBeenCalled();
  });

  test.each(calls)(
    "%s stops at a workspace the caller cannot reach, before the entitlement",
    async (_name, call) => {
      vi.mocked(getContactRow).mockResolvedValue(row);
      vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(new Response(null, { status: 403 }));

      const response = await call();

      expect(response.status).toBe(403);
      // The entitlement answer is only given to a caller who holds the permission.
      expect(getIsContactsEnabled).not.toHaveBeenCalled();
      for (const fn of touchedData()) expect(fn).not.toHaveBeenCalled();
    }
  );

  test("reads ask for read access and every mutation for readWrite", async () => {
    vi.mocked(getContactRow).mockResolvedValue(row);
    vi.mocked(listContactRows).mockResolvedValue({ page: [], nextCursor: null });
    vi.mocked(countContactRows).mockResolvedValue(0);
    vi.mocked(findContactIdByUserId).mockResolvedValue(contactId);
    vi.mocked(updateAttributes).mockResolvedValue({ success: true });

    const levels = async (call: () => Promise<Response>) => {
      vi.mocked(requireV3WorkspaceAccess).mockClear();
      await call();
      return vi.mocked(requireV3WorkspaceAccess).mock.calls[0]?.[2];
    };

    expect(await levels(calls[0][1])).toBe("read");
    expect(await levels(calls[1][1])).toBe("read");
    expect(await levels(calls[2][1])).toBe("read");
    expect(await levels(calls[3][1])).toBe("readWrite");
    expect(await levels(calls[4][1])).toBe("readWrite");
    expect(await levels(calls[5][1])).toBe("readWrite");
  });
});

describe("tenant scoping of id-addressed operations", () => {
  test("an unknown contact answers 403 like another tenant's, and no access check runs", async () => {
    vi.mocked(getContactRow).mockResolvedValue(null);

    const response = await getV3Contact({ ...base, contactId });

    expect(response.status).toBe(403);
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
  });

  test.each([
    ["get", () => getV3Contact({ ...base, contactId }), "read"],
    ["update", () => updateV3Contact({ ...base, contactId, body: { attributes: { a: "b" } } }), "readWrite"],
    ["delete", () => deleteV3Contact({ ...base, contactId }), "readWrite"],
  ] as const)("%s authorizes against the contact's own workspace", async (_name, call, level) => {
    vi.mocked(getContactRow).mockResolvedValue(row);
    vi.mocked(updateAttributes).mockResolvedValue({ success: true });

    await call();

    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      null,
      workspaceId,
      level,
      "req_1",
      "/api/v3/contacts"
    );
  });

  test("a contact of a workspace the caller cannot access is never returned", async () => {
    vi.mocked(getContactRow).mockResolvedValue({ ...row, workspaceId: "clot1234567890123456789012" });
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(new Response(null, { status: 403 }));

    const response = await getV3Contact({ ...base, contactId });

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("");
  });

  test("the list filters on the workspace the access check returned", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({
      workspaceId: "clre1234567890123456789012",
      organizationId,
    } as Awaited<ReturnType<typeof requireV3WorkspaceAccess>>);
    vi.mocked(listContactRows).mockResolvedValue({ page: [], nextCursor: null });

    await listV3Contacts({ ...base, query: { workspaceId, limit: 20, userId: "u_1" } });

    expect(listContactRows).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ workspaceId: "clre1234567890123456789012", userId: "u_1" }),
      })
    );
  });
});

describe("listV3Contacts pagination", () => {
  test("answers the page with the applied limit and the next cursor", async () => {
    vi.mocked(listContactRows).mockResolvedValue({ page: [row], nextCursor: "next" });

    const response = await listV3Contacts({ ...base, query: { workspaceId, limit: 5 } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta).toEqual({ limit: 5, nextCursor: "next" });
    expect(body.data[0]).toEqual({
      id: contactId,
      workspaceId,
      createdAt: "2026-04-21T10:00:00.000Z",
      updatedAt: "2026-04-21T11:00:00.000Z",
      attributes: { userId: "u_1", age: "42" },
    });
    expect(listContactRows).toHaveBeenCalledWith(expect.objectContaining({ limit: 5, cursor: null }));
  });

  test("a malformed cursor is a 400 naming cursor, and nothing is queried", async () => {
    const response = await listV3Contacts({
      ...base,
      query: { workspaceId, limit: 20, cursor: "not-a-cursor" },
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.invalid_params).toEqual([expect.objectContaining({ name: "cursor" })]);
    expect(listContactRows).not.toHaveBeenCalled();
  });

  const cursorFor = (filters: Record<string, string>) =>
    encodeKeysetCursor({
      version: 1,
      kind: CONTACT_LIST_KIND,
      sortBy: CONTACT_LIST_SORT,
      fp: computeFilterFingerprint({ workspaceId, ...filters }),
      value: "2026-04-21T10:00:00.000Z",
      id: contactId,
    });

  test("a cursor is accepted for the filter set it was issued for and refused for another", async () => {
    vi.mocked(listContactRows).mockResolvedValue({ page: [], nextCursor: null });
    const issued = cursorFor({ userId: "u_1" });

    const same = await listV3Contacts({
      ...base,
      query: { workspaceId, limit: 20, userId: "u_1", cursor: issued },
    });
    expect(same.status).toBe(200);
    expect(listContactRows).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: expect.objectContaining({ id: contactId }) })
    );

    vi.mocked(listContactRows).mockClear();
    const other = await listV3Contacts({
      ...base,
      query: { workspaceId, limit: 20, userId: "u_2", cursor: issued },
    });
    expect(other.status).toBe(400);
    expect(listContactRows).not.toHaveBeenCalled();
  });
});

describe("countV3Contacts", () => {
  test("counts within the authorized workspace with the filters given", async () => {
    vi.mocked(countContactRows).mockResolvedValue(7);

    const response = await countV3Contacts({
      ...base,
      query: { workspaceId, attributeKey: "plan", attributeValue: "pro" },
    });

    expect((await response.json()).data).toEqual({ count: 7 });
    expect(countContactRows).toHaveBeenCalledWith({
      workspaceId,
      userId: undefined,
      attributeKey: "plan",
      attributeValue: "pro",
    });
  });
});

describe("upsertV3Contact", () => {
  test("creates the contact when the userId is new, then sets the other attributes", async () => {
    vi.mocked(findContactIdByUserId).mockResolvedValue(null);
    vi.mocked(createContactWithUserId).mockResolvedValue({ id: contactId });
    vi.mocked(getContactRow).mockResolvedValue(row);
    vi.mocked(updateAttributes).mockResolvedValue({ success: true });

    const response = await upsertV3Contact({
      ...base,
      body: { workspaceId, userId: "u_1", attributes: { plan: "pro" } },
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v3/contacts/${contactId}`);
    expect(createContactWithUserId).toHaveBeenCalledWith(workspaceId, "u_1");
    expect(updateAttributes).toHaveBeenCalledWith(contactId, "u_1", workspaceId, { plan: "pro" });
  });

  test("updates the existing contact of that userId instead of creating a second one", async () => {
    vi.mocked(findContactIdByUserId).mockResolvedValue(contactId);
    vi.mocked(getContactRow).mockResolvedValue(row);
    vi.mocked(updateAttributes).mockResolvedValue({ success: true });

    const response = await upsertV3Contact({
      ...base,
      body: { workspaceId, userId: "u_1", attributes: { plan: "pro" } },
    });

    expect(response.status).toBe(200);
    expect(createContactWithUserId).not.toHaveBeenCalled();
    expect(findContactIdByUserId).toHaveBeenCalledWith(workspaceId, "u_1");
  });

  test("reports what the attribute service skipped as warnings, and nothing when it skipped nothing", async () => {
    vi.mocked(findContactIdByUserId).mockResolvedValue(contactId);
    vi.mocked(getContactRow).mockResolvedValue(row);
    vi.mocked(updateAttributes).mockResolvedValue({
      success: true,
      messages: [{ code: "email_already_exists", params: {} }],
      errors: [{ code: "invalid_attribute_keys", params: { keys: "Bad Key" } }],
    });

    const warned = await (
      await upsertV3Contact({
        ...base,
        body: { workspaceId, userId: "u_1", attributes: { email: "a@b.co" } },
      })
    ).json();
    expect(warned.warnings).toEqual(["formatted:email_already_exists", "formatted:invalid_attribute_keys"]);

    vi.mocked(updateAttributes).mockResolvedValue({ success: true });
    const clean = await (
      await upsertV3Contact({ ...base, body: { workspaceId, userId: "u_1", attributes: { plan: "pro" } } })
    ).json();
    expect(clean).not.toHaveProperty("warnings");
  });

  test("without attributes it only identifies the contact", async () => {
    vi.mocked(findContactIdByUserId).mockResolvedValue(contactId);
    vi.mocked(getContactRow).mockResolvedValue(row);

    await upsertV3Contact({ ...base, body: { workspaceId, userId: "u_1" } });

    expect(updateAttributes).not.toHaveBeenCalled();
  });

  test("records who and what in the audit log", async () => {
    vi.mocked(findContactIdByUserId).mockResolvedValue(contactId);
    vi.mocked(getContactRow).mockResolvedValue(row);
    const auditLog = {} as NonNullable<Parameters<typeof upsertV3Contact>[0]["auditLog"]>;

    await upsertV3Contact({ ...base, auditLog, body: { workspaceId, userId: "u_1" } });

    expect(auditLog).toMatchObject({ organizationId, targetId: contactId });
    expect(auditLog.oldObject).toMatchObject({ id: contactId });
    expect(auditLog.newObject).toMatchObject({ id: contactId });
  });

  test("a failure inside the service is a problem document, not a throw", async () => {
    vi.mocked(findContactIdByUserId).mockRejectedValue(new Error("boom"));

    const response = await upsertV3Contact({ ...base, body: { workspaceId, userId: "u_1" } });

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("boom");
  });
});

describe("updateV3Contact", () => {
  test("removes the named keys within the workspace, then merges the attributes", async () => {
    vi.mocked(getContactRow).mockResolvedValue(row);
    vi.mocked(updateAttributes).mockResolvedValue({ success: true });

    const response = await updateV3Contact({
      ...base,
      contactId,
      body: { attributes: { plan: "pro" }, removeAttributeKeys: ["legacy"] },
    });

    expect(response.status).toBe(200);
    expect(removeContactAttributes).toHaveBeenCalledWith(contactId, workspaceId, ["legacy"]);
    // Merge semantics: deleteRemovedAttributes stays off (the fifth argument is not passed).
    expect(updateAttributes).toHaveBeenCalledWith(contactId, "", workspaceId, { plan: "pro" });
  });

  test("removing without setting leaves the attribute service alone", async () => {
    vi.mocked(getContactRow).mockResolvedValue(row);

    await updateV3Contact({ ...base, contactId, body: { removeAttributeKeys: ["legacy"] } });

    expect(updateAttributes).not.toHaveBeenCalled();
  });
});

describe("deleteV3Contact", () => {
  test("deletes the contact and answers its id, with the contact in the audit log", async () => {
    vi.mocked(getContactRow).mockResolvedValue(row);
    const auditLog = {} as NonNullable<Parameters<typeof deleteV3Contact>[0]["auditLog"]>;

    const response = await deleteV3Contact({ ...base, contactId, auditLog });

    expect((await response.json()).data).toEqual({ id: contactId });
    expect(deleteContact).toHaveBeenCalledWith(contactId);
    expect(auditLog.oldObject).toMatchObject({ id: contactId });
  });
});
