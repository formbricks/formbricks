import type { McpServer } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { z } from "zod";
import { listV3ActionClasses } from "@/app/api/v3/action-classes/lib/operations";
import { listV3ContactAttributeKeys } from "@/app/api/v3/contact-attribute-keys/lib/operations";
import { listV3ContactAttributeValues } from "@/app/api/v3/contacts/attribute-values/lib/operations";
import { listV3Contacts } from "@/app/api/v3/contacts/lib/operations";
import { successListResponse, successResponse } from "@/app/api/v3/lib/response";
import { listV3Segments } from "@/app/api/v3/segments/lib/operations";
import type { TMcpGrantPermissions } from "../grant";
import { registerAudienceTools } from "./audience";
import { ZMcpListContactsInput } from "./audience-schemas";
import { FULL_MCP_GRANT } from "./test-utils";

vi.mock("@/app/api/v3/contacts/lib/operations", () => ({ listV3Contacts: vi.fn() }));
vi.mock("@/app/api/v3/contacts/attribute-values/lib/operations", () => ({
  listV3ContactAttributeValues: vi.fn(),
}));
vi.mock("@/app/api/v3/contact-attribute-keys/lib/operations", () => ({
  listV3ContactAttributeKeys: vi.fn(),
}));
vi.mock("@/app/api/v3/segments/lib/operations", () => ({ listV3Segments: vi.fn() }));
vi.mock("@/app/api/v3/action-classes/lib/operations", () => ({ listV3ActionClasses: vi.fn() }));

const workspaceId = "clws000000000000000000001";

const oauthAuthInfo = (scopes: string[], permissions: TMcpGrantPermissions = FULL_MCP_GRANT.permissions) => ({
  token: "oauth:user_1:client_1",
  clientId: "client_1",
  scopes,
  extra: {
    formbricksAuthentication: {
      user: { id: "user_1", email: "person@example.com", name: "Person" },
      expires: "2026-07-01T00:00:00.000Z",
    },
    requestId: "req_tool",
    authMethod: "oauth",
    grant: { access: "all", permissions },
  },
});

type TToolResult = { isError?: boolean; content?: { text?: string }[] };
type TToolHandler = (input: unknown, extra: unknown) => Promise<TToolResult>;

function createToolServer() {
  const tools = new Map<string, { config: Record<string, unknown>; handler: TToolHandler }>();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: TToolHandler) => {
      tools.set(name, { config, handler });
    }),
  };
  registerAudienceTools(server as unknown as McpServer);
  return tools;
}

const call = (name: string, input: unknown, authInfo = oauthAuthInfo(["audience:read"])) => {
  const tool = createToolServer().get(name);
  if (!tool) throw new Error(`${name} is not registered`);
  // The SDK validates arguments against the tool's input schema (applying its defaults) before the handler.
  const parsed = (tool.config.inputSchema as z.ZodType).parse(input);
  return tool.handler(parsed, { http: { authInfo } });
};

const textOf = (result: TToolResult) => result.content?.map((block) => block.text ?? "").join("") ?? "";

/** The search params an operation was called with, as `[name, value]` pairs in order. */
const paramsOf = (operation: typeof listV3Contacts) => [
  ...(vi.mocked(operation).mock.calls[0][0].searchParams as URLSearchParams).entries(),
];

const TOOLS = {
  list_contacts: { input: { workspaceId }, operation: listV3Contacts, permission: "Contacts: Read" },
  list_contact_attribute_keys: {
    input: { workspaceId },
    operation: listV3ContactAttributeKeys,
    permission: "Contact attributes: Read",
  },
  list_contact_attribute_values: {
    input: { workspaceId, key: "plan" },
    operation: listV3ContactAttributeValues,
    permission: "Contact attributes: Read",
  },
  list_segments: { input: { workspaceId }, operation: listV3Segments, permission: "Segments: Read" },
  list_action_classes: {
    input: { workspaceId },
    operation: listV3ActionClasses,
    permission: "Action classes: Read",
  },
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  const list = successListResponse([], { limit: 20, nextCursor: null, totalCount: null }, { requestId: "r" });
  vi.mocked(listV3Contacts).mockResolvedValue(list);
  vi.mocked(listV3ContactAttributeKeys).mockResolvedValue(list);
  vi.mocked(listV3Segments).mockResolvedValue(list);
  vi.mocked(listV3ActionClasses).mockResolvedValue(list);
  vi.mocked(listV3ContactAttributeValues).mockResolvedValue(successResponse([], { requestId: "r" }));
});

describe("the registered surface", () => {
  test("is one read-only tool per audience list operation", () => {
    const tools = createToolServer();

    expect([...tools.keys()]).toEqual(Object.keys(TOOLS));
    for (const [name, { config }] of tools) {
      expect(config.annotations, name).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    }
  });
});

describe.each(Object.entries(TOOLS))("%s", (name, { input, operation, permission }) => {
  test("runs its operation for a token holding audience:read and a grant giving the permission", async () => {
    const result = await call(name, input);

    expect(result.isError, textOf(result)).toBeUndefined();
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test("is refused without audience:read, whatever else the token holds", async () => {
    const result = await call(
      name,
      input,
      oauthAuthInfo(["surveys:read", "responses:read", "dashboards:read"])
    );

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("audience:read");
    expect(operation).not.toHaveBeenCalled();
  });

  test("is not permitted when the grant leaves the permission at No access", async () => {
    const result = await call(name, input, oauthAuthInfo(["audience:read"], { surveys: "write" }));

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`Not permitted`);
    expect(textOf(result)).toContain(permission);
    expect(operation).not.toHaveBeenCalled();
  });
});

describe("list_contacts", () => {
  test("sends the workspace and the default page size, and nothing else, when given only a workspace", async () => {
    await call("list_contacts", { workspaceId });

    expect(paramsOf(listV3Contacts)).toEqual([
      ["workspaceId", workspaceId],
      ["limit", "20"],
    ]);
  });

  test("maps every argument onto the query the operation parses", async () => {
    await call("list_contacts", {
      workspaceId,
      limit: 5,
      cursor: "next",
      includeTotalCount: true,
      search: "ada",
      sortBy: "createdAt",
      filter: {
        createdAt: { gte: "2026-01-01T00:00:00Z", lte: "2026-02-01T00:00:00Z" },
        attributes: [
          { key: "plan", operator: "in", values: ["pro", "team"] },
          { key: "email", operator: "isSet" },
        ],
      },
    });

    expect(paramsOf(listV3Contacts)).toEqual([
      ["workspaceId", workspaceId],
      ["limit", "5"],
      ["cursor", "next"],
      ["includeTotalCount", "true"],
      ["search", "ada"],
      ["sortBy", "createdAt"],
      ["filter[createdAt][gte]", "2026-01-01T00:00:00Z"],
      ["filter[createdAt][lte]", "2026-02-01T00:00:00Z"],
      ["filter[attribute.plan][in]", "pro"],
      ["filter[attribute.plan][in]", "team"],
      ["filter[attribute.email][isSet]", "true"],
    ]);
  });

  test("refuses an operator that compares with no value, rather than dropping the filter", () => {
    // A dropped filter would list more contacts than the agent asked for, silently.
    const parsed = ZMcpListContactsInput.safeParse({
      workspaceId,
      filter: { attributes: [{ key: "plan", operator: "eq" }] },
    });

    expect(parsed.success).toBe(false);
  });
});

describe("list_contact_attribute_keys", () => {
  test("maps its filters onto the operation's query", async () => {
    await call("list_contact_attribute_keys", {
      workspaceId,
      search: "pl",
      sortBy: "name",
      includeTotalCount: true,
      filter: { dataType: { in: ["string", "number"] }, type: { in: ["custom"] } },
    });

    expect(paramsOf(listV3ContactAttributeKeys)).toEqual([
      ["workspaceId", workspaceId],
      ["limit", "50"],
      ["includeTotalCount", "true"],
      ["search", "pl"],
      ["sortBy", "name"],
      ["filter[dataType][in]", "string"],
      ["filter[dataType][in]", "number"],
      ["filter[type][in]", "custom"],
    ]);
  });
});

describe("list_contact_attribute_values", () => {
  test("passes the key, the value filter and the page size to the operation", async () => {
    await call("list_contact_attribute_values", {
      workspaceId,
      key: "plan",
      filter: { value: { contains: "pro" } },
      limit: 10,
    });

    expect(vi.mocked(listV3ContactAttributeValues).mock.calls[0][0].query).toEqual({
      workspaceId,
      key: "plan",
      "filter[value][contains]": "pro",
      limit: 10,
    });
  });
});

describe("list_segments", () => {
  test("maps the title filter and sort onto the operation's query", async () => {
    await call("list_segments", { workspaceId, sortBy: "title", filter: { title: { contains: "beta" } } });

    expect(paramsOf(listV3Segments)).toEqual([
      ["workspaceId", workspaceId],
      ["limit", "20"],
      ["sortBy", "title"],
      ["filter[title][contains]", "beta"],
    ]);
  });
});

describe("list_action_classes", () => {
  test("passes the workspace, page size and cursor to the operation", async () => {
    await call("list_action_classes", { workspaceId, cursor: "c1" });

    expect(vi.mocked(listV3ActionClasses).mock.calls[0][0]).toMatchObject({
      workspaceId,
      limit: 50,
      cursor: "c1",
    });
  });
});
