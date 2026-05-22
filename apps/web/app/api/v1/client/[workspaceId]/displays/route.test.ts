import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

const { mockCreateDisplay, mockResolveClientApiIds } = vi.hoisted(() => ({
  mockCreateDisplay: vi.fn(),
  mockResolveClientApiIds: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn(),
}));

vi.mock("@/lib/utils/resolve-client-id", () => ({
  resolveClientApiIds: mockResolveClientApiIds,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: vi.fn(),
}));

vi.mock("./lib/display", () => ({
  createDisplay: mockCreateDisplay,
}));

type TDisplayPostHandler = (params: {
  req: Request;
  props: { params: Promise<{ workspaceId: string }> };
}) => Promise<{ response: Response }>;

const workspaceId = "ck12345678901234567890123";

const createRequest = (body: string): Request =>
  new Request(`https://app.test/api/v1/client/${workspaceId}/displays`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

describe("POST /api/v1/client/[workspaceId]/displays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveClientApiIds.mockResolvedValue({ workspaceId });
  });

  test("returns 400 for malformed JSON without creating a display", async () => {
    const { response } = await (POST as unknown as TDisplayPostHandler)({
      req: createRequest("{invalid-json"),
      props: { params: Promise.resolve({ workspaceId }) },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "bad_request",
      message: "Malformed JSON input, please check your request body",
      details: {
        error: expect.any(String),
      },
    });
    expect(mockCreateDisplay).not.toHaveBeenCalled();
  });
});
