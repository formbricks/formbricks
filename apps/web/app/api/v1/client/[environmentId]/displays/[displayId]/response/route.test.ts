import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getResponseIdByDisplayId } from "./lib/response";
import { GET } from "./route";

vi.mock("@/app/lib/api/with-api-logging", async () => {
  return {
    withV1ApiWrapper:
      ({ handler }: { handler: any }) =>
      async (req: NextRequest, props: any) => {
        const result = await handler({ req, props });
        return result.response;
      },
  };
});

vi.mock("./lib/response", () => ({
  getResponseIdByDisplayId: vi.fn(),
}));

describe("GET /api/v1/client/[environmentId]/displays/[displayId]/response", () => {
  const req = new NextRequest("http://localhost/api/v1/client/env/displays/display/response");
  const props = {
    params: Promise.resolve({
      environmentId: "env1234567890123456789012",
      displayId: "display1234567890123456789",
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the responseId when a linked response exists", async () => {
    vi.mocked(getResponseIdByDisplayId).mockResolvedValue({ responseId: "response123456789012345678" });

    const response = await GET(req, props);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        responseId: "response123456789012345678",
      },
    });
  });

  test("returns null when the display exists without a response", async () => {
    vi.mocked(getResponseIdByDisplayId).mockResolvedValue({ responseId: null });

    const response = await GET(req, props);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        responseId: null,
      },
    });
  });

  test("returns 404 when the display is missing for the environment", async () => {
    vi.mocked(getResponseIdByDisplayId).mockRejectedValue(
      new ResourceNotFoundError("Display", "display1234567890123456789")
    );

    const response = await GET(req, props);

    expect(response.status).toBe(404);
  });
});
