import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createV3ContactAttributeKey,
  deleteV3ContactAttributeKey,
  updateV3ContactAttributeKey,
} from "@/app/api/v3/contacts/lib/attribute-key-operations";
import {
  countV3Contacts,
  deleteV3Contact,
  getV3Contact,
  listV3Contacts,
  updateV3Contact,
  upsertV3Contact,
} from "@/app/api/v3/contacts/lib/operations";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { problemForbidden, successListResponse, successResponse } from "@/app/api/v3/lib/response";
import {
  createV3SegmentFromRawInput,
  deleteV3Segment,
  getV3Segment,
  listV3Segments,
  updateV3SegmentFromRawInput,
} from "@/app/api/v3/segments/lib/operations";
import {
  ZMcpCountContactsInput,
  ZMcpDeleteContactAttributeKeyInput,
  ZMcpDeleteContactInput,
  ZMcpListContactsInput,
  ZMcpUpdateContactInput,
  ZMcpUpdateSegmentInput,
  ZMcpUpsertContactInput,
} from "./contact-schemas";
import { registerContactTools } from "./contacts";

vi.mock("@/app/api/v3/contacts/lib/operations", () => ({
  listV3Contacts: vi.fn(),
  countV3Contacts: vi.fn(),
  getV3Contact: vi.fn(),
  upsertV3Contact: vi.fn(),
  updateV3Contact: vi.fn(),
  deleteV3Contact: vi.fn(),
}));

vi.mock("@/app/api/v3/contacts/lib/attribute-key-operations", () => ({
  createV3ContactAttributeKey: vi.fn(),
  updateV3ContactAttributeKey: vi.fn(),
  deleteV3ContactAttributeKey: vi.fn(),
}));

vi.mock("@/app/api/v3/segments/lib/operations", () => ({
  listV3Segments: vi.fn(),
  getV3Segment: vi.fn(),
  createV3SegmentFromRawInput: vi.fn(),
  updateV3SegmentFromRawInput: vi.fn(),
  deleteV3Segment: vi.fn(),
}));

vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(),
  queueV3AuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const session = {
  user: { id: "user_1", email: "person@example.com", name: "Person" },
  expires: "2026-07-01T00:00:00.000Z",
};

const authInfoFor = (scopes: string[]) => ({
  token: "oauth:user_1:client_1",
  clientId: "client_1",
  scopes,
  extra: { formbricksAuthentication: session, requestId: "req_tool", authMethod: "oauth" },
});

const readAuthInfo = authInfoFor(["contacts:read"]);
const writeAuthInfo = authInfoFor(["contacts:write"]);

const workspaceId = "tz4a98xxat96iws9zmbrgj3a";
const contactId = "kj4a98xxat96iws9zmbrgj3a";
const attributeKeyId = "bq7m4qr9w2ft6bx1hs8dvn3c";
const segmentId = "hn5c2xk8d4lv7pt0ra9sbw6e";

type TToolResult = {
  isError?: boolean;
  structuredContent: { data?: unknown; error?: unknown };
};
type TToolHandler = (input: Record<string, unknown>, extra: unknown) => Promise<TToolResult>;

function createToolServer() {
  const tools = new Map<string, { config: Record<string, unknown>; handler: TToolHandler }>();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: TToolHandler) => {
      tools.set(name, { config, handler });
    }),
  };
  registerContactTools(server as unknown as Parameters<typeof registerContactTools>[0]);
  return { tools };
}

const READ_TOOLS: Record<string, { input: Record<string, unknown>; operation: unknown }> = {
  list_contacts: { input: { workspaceId, limit: 20 }, operation: listV3Contacts },
  count_contacts: { input: { workspaceId }, operation: countV3Contacts },
  get_contact: { input: { contactId }, operation: getV3Contact },
  list_segments: { input: { workspaceId, limit: 20 }, operation: listV3Segments },
  get_segment: { input: { segmentId }, operation: getV3Segment },
};

const WRITE_TOOLS: Record<string, { input: Record<string, unknown>; operation: unknown }> = {
  upsert_contact: { input: { workspaceId, userId: "u_1" }, operation: upsertV3Contact },
  update_contact: { input: { contactId, attributes: { plan: "pro" } }, operation: updateV3Contact },
  delete_contact: { input: { contactId, confirm: true }, operation: deleteV3Contact },
  create_contact_attribute_key: {
    input: { workspaceId, key: "plan" },
    operation: createV3ContactAttributeKey,
  },
  update_contact_attribute_key: {
    input: { attributeKeyId, name: "Plan" },
    operation: updateV3ContactAttributeKey,
  },
  delete_contact_attribute_key: {
    input: { attributeKeyId, confirm: true },
    operation: deleteV3ContactAttributeKey,
  },
  create_segment: {
    input: { workspaceId, title: "Pro users", filters: [{ id: "f1" }] },
    operation: createV3SegmentFromRawInput,
  },
  update_segment: { input: { segmentId, title: "Renamed" }, operation: updateV3SegmentFromRawInput },
  delete_segment: { input: { segmentId }, operation: deleteV3Segment },
};

describe("registerContactTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildV3AuditLog).mockReturnValue(undefined);
  });

  test("registers exactly the contact, attribute key and segment tools", () => {
    const { tools } = createToolServer();
    expect([...tools.keys()].sort()).toEqual(
      [...Object.keys(READ_TOOLS), ...Object.keys(WRITE_TOOLS)].sort()
    );
  });

  test("marks the reads read-only and every removal or replacement destructive", () => {
    const { tools } = createToolServer();

    for (const name of Object.keys(READ_TOOLS)) {
      expect(tools.get(name)!.config.annotations, name).toMatchObject({ readOnlyHint: true });
    }
    for (const name of [
      "delete_contact",
      "update_contact",
      "delete_contact_attribute_key",
      "update_segment",
      "delete_segment",
    ]) {
      expect(tools.get(name)!.config.annotations, name).toMatchObject({ destructiveHint: true });
    }
    expect(tools.get("upsert_contact")!.config.annotations).toMatchObject({ destructiveHint: false });
  });

  test("delete_contact is refused without responses:write, since the contact's responses go with it", async () => {
    const { tools } = createToolServer();

    const result = await tools
      .get("delete_contact")!
      .handler({ contactId, confirm: true }, { http: { authInfo: writeAuthInfo } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403 });
    expect(deleteV3Contact).not.toHaveBeenCalled();
  });

  test("every read tool is refused with only a write scope, without reaching the operation", async () => {
    const { tools } = createToolServer();

    for (const [name, { input, operation }] of Object.entries(READ_TOOLS)) {
      const result = await tools.get(name)!.handler(input, { http: { authInfo: writeAuthInfo } });
      expect(result.isError, name).toBe(true);
      expect(result.structuredContent.error, name).toMatchObject({ status: 403 });
      expect(operation, name).not.toHaveBeenCalled();
    }
  });

  test("every mutation is refused with only a read scope, without reaching the operation", async () => {
    const { tools } = createToolServer();

    for (const [name, { input, operation }] of Object.entries(WRITE_TOOLS)) {
      const result = await tools.get(name)!.handler(input, { http: { authInfo: readAuthInfo } });
      expect(result.isError, name).toBe(true);
      expect(result.structuredContent.error, name).toMatchObject({ status: 403 });
      expect(operation, name).not.toHaveBeenCalled();
    }
  });

  test("list_contacts passes the filters and the caller's authentication to the operation", async () => {
    const { tools } = createToolServer();
    const contact = {
      id: contactId,
      workspaceId,
      createdAt: "a",
      updatedAt: "b",
      attributes: { userId: "u_1" },
    };
    vi.mocked(listV3Contacts).mockResolvedValue(
      successListResponse([contact], { limit: 20, nextCursor: null }, { requestId: "req_tool" })
    );

    const result = await tools
      .get("list_contacts")!
      .handler({ workspaceId, limit: 20, userId: "u_1" }, { http: { authInfo: readAuthInfo } });

    expect(listV3Contacts).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { workspaceId, limit: 20, userId: "u_1" },
        authentication: session,
        instance: "/api/mcp",
      })
    );
    expect(result.structuredContent.data).toEqual([contact]);
  });

  test("upsert_contact audits a createdUpdated contact event and relays the warnings", async () => {
    const { tools } = createToolServer();
    vi.mocked(upsertV3Contact).mockResolvedValue(
      successResponse(
        { id: contactId, workspaceId, createdAt: "a", updatedAt: "b", attributes: { userId: "u_1" } },
        { requestId: "req_tool", extensions: { warnings: ["The email already exists"] } }
      )
    );

    const result = await tools
      .get("upsert_contact")!
      .handler({ workspaceId, userId: "u_1" }, { http: { authInfo: writeAuthInfo } });

    expect(buildV3AuditLog).toHaveBeenCalledWith(session, "createdUpdated", "contact", expect.any(String));
    expect(queueV3AuditLog).toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ warnings: ["The email already exists"] });
  });

  test("update_segment sends the changes without the id, which addresses the segment", async () => {
    const { tools } = createToolServer();
    vi.mocked(updateV3SegmentFromRawInput).mockResolvedValue(
      successResponse({ id: segmentId }, { requestId: "req_tool" })
    );

    await tools
      .get("update_segment")!
      .handler({ segmentId, title: "Renamed" }, { http: { authInfo: writeAuthInfo } });

    expect(updateV3SegmentFromRawInput).toHaveBeenCalledWith(
      expect.objectContaining({ segmentId, body: { title: "Renamed" } })
    );
  });

  test("relays an operation refusal unchanged, as the entitlement gate answers it", async () => {
    const { tools } = createToolServer();
    vi.mocked(listV3Segments).mockResolvedValue(
      problemForbidden("req_tool", "The contacts feature is not enabled for this organization.")
    );

    const result = await tools
      .get("list_segments")!
      .handler({ workspaceId, limit: 20 }, { http: { authInfo: readAuthInfo } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      status: 403,
      detail: "The contacts feature is not enabled for this organization.",
    });
  });
});

describe("contact tool output schemas", () => {
  // The SDK validates every successful result against the schema the tool advertised, so a schema that
  // disagrees with what the operations really answer fails every call that would otherwise succeed.
  const validate = async (tool: string, payload: unknown) => {
    const { tools } = createToolServer();
    const schema = tools.get(tool)!.config.outputSchema as {
      "~standard": { validate: (value: unknown) => Promise<{ issues?: unknown[] }> };
    };
    return (await schema["~standard"].validate(payload)).issues;
  };

  const contact = {
    id: contactId,
    workspaceId,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    attributes: { userId: "u_1" },
  };

  test("a contact page carries only limit and nextCursor in its meta", async () => {
    const page = { data: [contact], meta: { limit: 20, nextCursor: null }, requestId: "r" };
    expect(await validate("list_contacts", page)).toBeUndefined();
    expect(
      await validate("list_segments", { data: [], meta: { limit: 20, nextCursor: "x" } })
    ).toBeUndefined();
  });

  test("an upsert answers the contact beside its warnings", async () => {
    expect(
      await validate("upsert_contact", { data: contact, warnings: ["skipped"], requestId: "r" })
    ).toBeUndefined();
  });

  test("a segment carries its filter tree and the surveys using it", async () => {
    const segment = {
      id: segmentId,
      workspaceId,
      title: "Pro users",
      description: null,
      createdAt: "a",
      updatedAt: "b",
      filters: [{ id: "n1", connector: null, resource: [] }],
      surveys: [{ id: "s1", name: "NPS", status: "inProgress" }],
    };
    expect(await validate("get_segment", { data: segment, requestId: "r" })).toBeUndefined();
  });

  test("a count and a delete answer their small resources", async () => {
    expect(await validate("count_contacts", { data: { count: 3 }, requestId: "r" })).toBeUndefined();
    expect(await validate("delete_segment", { data: { id: segmentId }, requestId: "r" })).toBeUndefined();
  });
});

describe("contact tool input schemas", () => {
  const base = { workspaceId };

  test("page size is capped below the REST maximum and defaults to 20", () => {
    expect(ZMcpListContactsInput.parse(base).limit).toBe(20);
    expect(ZMcpListContactsInput.safeParse({ ...base, limit: 50 }).success).toBe(true);
    expect(ZMcpListContactsInput.safeParse({ ...base, limit: 51 }).success).toBe(false);
    expect(ZMcpListContactsInput.safeParse({ ...base, limit: 0 }).success).toBe(false);
  });

  test("an attribute filter needs both its key and its value", () => {
    expect(ZMcpListContactsInput.safeParse({ ...base, attributeKey: "plan" }).success).toBe(false);
    expect(ZMcpCountContactsInput.safeParse({ ...base, attributeValue: "pro" }).success).toBe(false);
    expect(
      ZMcpCountContactsInput.safeParse({ ...base, attributeKey: "plan", attributeValue: "pro" }).success
    ).toBe(true);
  });

  test("reject an undeclared key instead of dropping it, so a misspelled filter cannot widen a query", () => {
    expect(ZMcpListContactsInput.safeParse({ ...base, userid: "u_1" }).success).toBe(false);
    expect(ZMcpCountContactsInput.safeParse({ ...base, userid: "u_1" }).success).toBe(false);
  });

  test("the userId of an upsert is not an attribute", () => {
    expect(
      ZMcpUpsertContactInput.safeParse({ workspaceId, userId: "u_1", attributes: { userId: "u_2" } }).success
    ).toBe(false);
    expect(
      ZMcpUpsertContactInput.safeParse({ workspaceId, userId: "u_1", attributes: { plan: "pro" } }).success
    ).toBe(true);
  });

  test("an update must change something, and default attributes cannot be removed", () => {
    expect(ZMcpUpdateContactInput.safeParse({ contactId }).success).toBe(false);
    expect(ZMcpUpdateContactInput.safeParse({ contactId, removeAttributeKeys: ["email"] }).success).toBe(
      false
    );
    expect(ZMcpUpdateContactInput.safeParse({ contactId, removeAttributeKeys: ["plan"] }).success).toBe(true);
  });

  test("a segment update must change something", () => {
    expect(ZMcpUpdateSegmentInput.safeParse({ segmentId }).success).toBe(false);
    expect(ZMcpUpdateSegmentInput.safeParse({ segmentId, description: null }).success).toBe(true);
  });

  test("deleting a contact or an attribute key requires confirm: true", () => {
    expect(ZMcpDeleteContactInput.safeParse({ contactId }).success).toBe(false);
    expect(ZMcpDeleteContactInput.safeParse({ contactId, confirm: false }).success).toBe(false);
    expect(ZMcpDeleteContactInput.safeParse({ contactId, confirm: true }).success).toBe(true);
    expect(ZMcpDeleteContactAttributeKeyInput.safeParse({ attributeKeyId }).success).toBe(false);
  });
});
