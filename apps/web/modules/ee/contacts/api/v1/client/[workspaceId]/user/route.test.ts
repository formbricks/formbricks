import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError } from "@formbricks/types/errors";
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

const identify = (attributes: unknown, userId = "user-1") =>
  (POST as unknown as (input: unknown) => Promise<{ response: Response }>)({
    req: new Request(`http://localhost/api/v1/client/${WORKSPACE_ID}/user`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, attributes }),
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

  // One entry, far under the attribute cap, so only the array check can refuse it.
  test("refuses attributes sent as an array before reading them", async () => {
    const { response } = await identify(["value"]);

    expect(response.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});

// ENG-4019: Postgres `text` cannot hold U+0000, so a NULL byte that reaches the contact upsert fails the
// whole write with 22021 and the identify call answers 500. It is refused at the boundary instead.
describe("POST /api/v1/client/[workspaceId]/user NULL bytes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveClientApiIds.mockResolvedValue({ workspaceId: WORKSPACE_ID });
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue("org-1");
    mocks.getIsContactsEnabled.mockResolvedValue(true);
    mocks.updateUser.mockResolvedValue({ state: {}, messages: [], errors: [] });
  });

  const expectRefused = async (response: Response) => {
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain("must not contain NULL bytes");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  };

  test("refuses an attribute value with a NULL byte", async () => {
    const { response } = await identify({ plan: "pro\u0000" });

    await expectRefused(response);
  });

  test("refuses an attribute key with a NULL byte", async () => {
    const { response } = await identify({ "pl\u0000an": "pro" });

    await expectRefused(response);
  });

  test("refuses a userId with a NULL byte", async () => {
    const { response } = await identify({ plan: "pro" }, "user\u00001");

    await expectRefused(response);
  });

  test("passes the same attributes without the NULL byte", async () => {
    const { response } = await identify({ plan: "pro", seats: 3, active: true });

    expect(response.status).toBe(200);
    expect(mocks.updateUser).toHaveBeenCalledOnce();
  });
});

describe("POST /api/v1/client/[workspaceId]/user failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveClientApiIds.mockResolvedValue({ workspaceId: WORKSPACE_ID });
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue("org-1");
    mocks.getIsContactsEnabled.mockResolvedValue(true);
  });

  // ENG-3725: a failed segment check reaches the route as a DatabaseError. It must answer 500 and hand the
  // error to the wrapper (which reports it), not a 200 with an empty segment list.
  test("answers 500 and passes the error on when the user state cannot be built", async () => {
    const error = new DatabaseError("Transaction already closed");
    mocks.updateUser.mockRejectedValue(error);

    const result = await (identify({}) as Promise<{ response: Response; error?: unknown }>);

    expect(result.response.status).toBe(500);
    expect(result.error).toBe(error);
  });
});
