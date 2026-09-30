import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { DatabaseError } from "@formbricks/types/errors";
import { GENERIC_API_ERROR_MESSAGE } from "@/app/lib/api/handle-api-error";
import { GET as getContactAttributes } from "./contact-attributes/route";
import { GET as getContacts } from "./contacts/route";

const mocks = vi.hoisted(() => ({
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

describe("v1 contact list error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIsContactsEnabled.mockResolvedValue(true);
  });

  test.each([
    ["contacts", getContacts, mocks.getContacts],
    ["contact attributes", getContactAttributes, mocks.getContactAttributes],
  ])("sanitizes database errors for %s", async (_name, route, loader) => {
    const internalMessage = "column workspace.secret violates constraint fk_secret";
    const error = new DatabaseError(internalMessage);
    loader.mockRejectedValue(error);

    const result = await invokeRoute(route);
    const body = await result.response.json();

    expect(result.response.status).toBe(500);
    expect(body).toEqual({
      code: "internal_server_error",
      details: {},
      message: GENERIC_API_ERROR_MESSAGE,
    });
    expect(JSON.stringify(body)).not.toContain(internalMessage);
    expect(result.error).toBe(error);
  });
});
