import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { V1_MANAGEMENT_MAX_LIMIT } from "@/app/api/v1/management/lib/pagination";
import { GET as getContactAttributeKeys } from "./contact-attribute-keys/route";
import { GET as getContactAttributes } from "./contact-attributes/route";
import { GET as getContacts } from "./contacts/route";

const mocks = vi.hoisted(() => ({
  getContactAttributeKeys: vi.fn(),
  getContactAttributes: vi.fn(),
  getContacts: vi.fn(),
  getIsContactsEnabled: vi.fn(),
}));

vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: mocks.getIsContactsEnabled }));
vi.mock("@/app/api/v1/management/lib/workspace-resolver", () => ({ resolveBodyIds: vi.fn() }));
vi.mock("./contact-attribute-keys/lib/contact-attribute-keys", () => ({
  createContactAttributeKey: vi.fn(),
  getContactAttributeKeys: mocks.getContactAttributeKeys,
}));
vi.mock("./contact-attributes/lib/contact-attributes", () => ({
  getContactAttributes: mocks.getContactAttributes,
}));
vi.mock("./contacts/lib/contacts", () => ({ getContacts: mocks.getContacts }));

const authentication = {
  apiKeyId: "api-key-1",
  organizationAccess: { accessControl: { read: false, write: false } },
  organizationId: "organization-1",
  type: "apiKey",
  workspacePermissions: [{ permission: "read", workspaceId: "workspace-1", workspaceName: "Production" }],
} as const satisfies TAuthenticationApiKey;

type TRoute = (params: { authentication: unknown; req: { nextUrl: URL } }) => Promise<unknown>;

const call = (route: unknown, query: string) =>
  (route as TRoute)({
    authentication,
    req: { nextUrl: new URL(`http://localhost/api/v1/management/x${query}`) },
  });

describe.each([
  ["contacts", getContacts, mocks.getContacts],
  ["contact attributes", getContactAttributes, mocks.getContactAttributes],
  ["contact attribute keys", getContactAttributeKeys, mocks.getContactAttributeKeys],
])("v1 %s list bounds", (_name, route, loader) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIsContactsEnabled.mockResolvedValue(true);
    loader.mockResolvedValue([]);
  });

  test("bounds a request that sends no limit", async () => {
    await call(route, "");
    expect(loader).toHaveBeenCalledWith(["workspace-1"], V1_MANAGEMENT_MAX_LIMIT, 0);
  });

  test("passes an in-range limit and skip through", async () => {
    await call(route, `?limit=${V1_MANAGEMENT_MAX_LIMIT}&skip=500`);
    expect(loader).toHaveBeenCalledWith(["workspace-1"], V1_MANAGEMENT_MAX_LIMIT, 500);
  });

  test("answers 400 for a limit above the ceiling instead of clamping it", async () => {
    const result = (await call(route, "?limit=1000000&skip=500")) as { response: Response };
    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toEqual(
      expect.objectContaining({ message: `limit must not exceed ${V1_MANAGEMENT_MAX_LIMIT}` })
    );
    expect(loader).not.toHaveBeenCalled();
  });
});
