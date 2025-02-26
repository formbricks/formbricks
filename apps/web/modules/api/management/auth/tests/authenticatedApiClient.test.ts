import { logApiRequest } from "@/modules/api/lib/utils";
import { describe, expect, it, vi } from "vitest";
import { apiWrapper } from "../apiWrapper";
import { authenticatedApiClient } from "../authenticatedApiClient";

vi.mock("../apiWrapper", () => ({
  apiWrapper: vi.fn(),
}));

vi.mock("@/modules/api/lib/utils", () => ({
  logApiRequest: vi.fn(),
}));

describe("authenticatedApiClient", () => {
  it("should log request and return response", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "valid-api-key" },
    });

    vi.mocked(apiWrapper).mockResolvedValue(new Response("ok", { status: 200 }));
    vi.mocked(logApiRequest).mockReturnValue();

    const handler = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const response = await authenticatedApiClient({
      request,
      handler,
    });

    expect(response.status).toBe(200);
    expect(logApiRequest).toHaveBeenCalled();
  });
});
