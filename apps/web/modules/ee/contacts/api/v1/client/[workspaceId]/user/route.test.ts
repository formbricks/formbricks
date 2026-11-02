import { beforeEach, describe, expect, test, vi } from "vitest";
import { MAX_CONTACT_ATTRIBUTES_PER_REQUEST } from "@/lib/constants";
import { POST } from "./route";

// `withV1ApiWrapper` is reduced to its handler: what it adds (rate limiting, logging) is orthogonal to
// the input bound proved here.
const mocks = vi.hoisted(() => ({
  getIsContactsEnabled: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  resolveClientApiIds: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));
vi.mock("@/lib/utils/resolve-client-id", () => ({ resolveClientApiIds: mocks.resolveClientApiIds }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: mocks.getIsContactsEnabled }));
vi.mock("./lib/update-user", () => ({ updateUser: mocks.updateUser }));

const WORKSPACE_ID = "clws00000000000000000001";

const identify = (attributes: Record<string, unknown>) =>
  (POST as unknown as (input: unknown) => Promise<{ response: Response }>)({
    req: new Request(`http://localhost/api/v1/client/${WORKSPACE_ID}/user`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-1", attributes }),
    }),
    props: { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) },
  });

const attributes = (count: number) =>
  Object.fromEntries(Array.from({ length: count }, (_, index) => [`attr${index}`, "value"]));

describe("POST /api/v1/client/[workspaceId]/user attribute cap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveClientApiIds.mockResolvedValue({ workspaceId: WORKSPACE_ID });
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue("org-1");
    mocks.getIsContactsEnabled.mockResolvedValue(true);
    mocks.updateUser.mockResolvedValue({ state: {}, messages: [], errors: [] });
  });

  test("passes a request at the cap to the update", async () => {
    const { response } = await identify(attributes(MAX_CONTACT_ATTRIBUTES_PER_REQUEST));

    expect(response.status).toBe(200);
    expect(mocks.updateUser).toHaveBeenCalledOnce();
  });

  test("refuses one attribute over the cap before the license check or the update", async () => {
    const { response } = await identify(attributes(MAX_CONTACT_ATTRIBUTES_PER_REQUEST + 1));

    expect(response.status).toBe(400);
    expect(mocks.getIsContactsEnabled).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
