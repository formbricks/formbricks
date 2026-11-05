import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

/**
 * `withV1ApiWrapper` is reduced to its handler: the logging, rate limiting and error mapping it adds are
 * orthogonal to the response body proved here.
 */
const mocks = vi.hoisted(() => ({
  getWorkspaceState: vi.fn(),
  resolveClientApiIds: vi.fn(),
}));

vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));

vi.mock("@/app/api/v1/client/[workspaceId]/environment/lib/environmentState", () => ({
  getWorkspaceState: mocks.getWorkspaceState,
}));

vi.mock("@/lib/utils/resolve-client-id", () => ({
  resolveClientApiIds: mocks.resolveClientApiIds,
}));

const workspaceId = "clworkspace000000000000001";

const callGet = async (): Promise<Response> => {
  const handler = GET as unknown as (args: {
    req: Request;
    props: { params: Promise<{ workspaceId: string }> };
  }) => Promise<{ response: Response }>;
  const { response } = await handler({
    req: new Request(`https://app.formbricks.test/api/v1/client/${workspaceId}/environment`),
    props: { params: Promise.resolve({ workspaceId }) },
  });
  return response;
};

describe("GET /api/v1/client/[workspaceId]/environment", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-10-20T02:00:00.000Z") });
    mocks.resolveClientApiIds.mockResolvedValue({ workspaceId });
    mocks.getWorkspaceState.mockResolvedValue({ data: { surveys: [], actionClasses: [] } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("tells the SDK when the server built the response, beside when to refetch it (ENG-3994)", async () => {
    const body = (await (await callGet()).json()) as { data: { expiresAt: string; serverTime: string } };

    expect(body.data.serverTime).toBe("2026-10-20T02:00:00.000Z");
    expect(body.data.expiresAt).toBe("2026-10-20T03:00:00.000Z");
  });
});
