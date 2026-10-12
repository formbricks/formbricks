import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { GENERIC_API_ERROR_MESSAGE } from "@/app/lib/api/handle-api-error";
import {
  GET as getContactAttributeKeys,
  POST as postContactAttributeKey,
} from "./contact-attribute-keys/route";
import { GET as getContactAttributes } from "./contact-attributes/route";
import { GET as getContacts } from "./contacts/route";

const mocks = vi.hoisted(() => ({
  createContactAttributeKey: vi.fn(),
  getContactAttributeKeys: vi.fn(),
  getContactAttributes: vi.fn(),
  getContacts: vi.fn(),
  getIsContactsEnabled: vi.fn(),
}));

vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: mocks.getIsContactsEnabled,
}));

vi.mock("./contact-attribute-keys/lib/contact-attribute-keys", () => ({
  createContactAttributeKey: mocks.createContactAttributeKey,
  getContactAttributeKeys: mocks.getContactAttributeKeys,
}));

vi.mock("@/app/api/v1/management/lib/workspace-resolver", () => ({
  resolveBodyIds: async (body: Record<string, unknown>) => ({
    ok: true,
    body: { ...body, workspaceId: "workspace-1" },
    alreadyAuthorized: true,
  }),
}));

vi.mock("./contact-attributes/lib/contact-attributes", () => ({
  getContactAttributes: mocks.getContactAttributes,
}));

vi.mock("./contacts/lib/contacts", () => ({
  getContacts: mocks.getContacts,
}));

const authentication = {
  apiKeyId: "api-key-1",
  organizationAccess: { accessControl: { read: false, write: false } },
  organizationId: "organization-1",
  type: "apiKey",
  workspacePermissions: [{ permission: "read", workspaceId: "workspace-1", workspaceName: "Production" }],
} as const satisfies TAuthenticationApiKey;

interface HandlerResult {
  response: Response;
  error?: unknown;
}

type RouteHandler = (params: { authentication: TAuthenticationApiKey }) => Promise<HandlerResult>;

const invokeRoute = (route: unknown): Promise<HandlerResult> => {
  return (route as RouteHandler)({ authentication });
};

const invokePost = (route: unknown, body: unknown): Promise<HandlerResult> => {
  const req = new Request("http://localhost/api/v1/management/contact-attribute-keys", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (
    route as (params: { authentication: TAuthenticationApiKey; req: Request }) => Promise<HandlerResult>
  )({ authentication, req });
};

const internalMessage = "column workspace.secret violates constraint fk_secret";

const expectSanitized = async (result: HandlerResult, error: unknown) => {
  const body = await result.response.json();

  expect(result.response.status).toBe(500);
  expect(body).toEqual({
    code: "internal_server_error",
    details: {},
    message: GENERIC_API_ERROR_MESSAGE,
  });
  expect(JSON.stringify(body)).not.toContain(internalMessage);
  // Still reaches server-side logging and Sentry through the wrapper.
  expect(result.error).toBe(error);
};

describe("v1 contact list error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIsContactsEnabled.mockResolvedValue(true);
  });

  test.each([
    ["contacts", getContacts, mocks.getContacts],
    ["contact attributes", getContactAttributes, mocks.getContactAttributes],
    // Answered with the raw message at 400 until ENG-3285; since Prisma 7.9 that message can be raw
    // Postgres text, because unmapped database errors now arrive as P2039 known errors.
    ["contact attribute keys", getContactAttributeKeys, mocks.getContactAttributeKeys],
  ])("sanitizes database errors for %s", async (_name, route, loader) => {
    const error = new DatabaseError(internalMessage);
    loader.mockRejectedValue(error);

    await expectSanitized(await invokeRoute(route), error);
  });
});

describe("v1 contact attribute key creation error handling", () => {
  const validBody = { workspaceId: "workspace-1", key: "plan", type: "custom" };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIsContactsEnabled.mockResolvedValue(true);
  });

  test("sanitizes database errors", async () => {
    const error = new DatabaseError(internalMessage);
    mocks.createContactAttributeKey.mockRejectedValue(error);

    await expectSanitized(await invokePost(postContactAttributeKey, validBody), error);
  });

  test("still tells the caller a key already exists", async () => {
    mocks.createContactAttributeKey.mockRejectedValue(new InvalidInputError("Attribute key already exists"));

    const result = await invokePost(postContactAttributeKey, validBody);

    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toMatchObject({ message: "Attribute key already exists" });
  });
});
