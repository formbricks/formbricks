import { getEnvironmentIdFromApiKey } from "@/modules/api/v2/management/lib/api-key";
import { hashApiKey } from "@/modules/api/v2/management/lib/utils";
import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@formbricks/types/error-handlers";
import { authenticateRequest } from "../authenticate-request";

vi.mock("@/modules/api/v2/management/lib/api-key", () => ({
  getEnvironmentIdFromApiKey: vi.fn(),
}));

vi.mock("@/modules/api/v2/management/lib/utils", () => ({
  hashApiKey: vi.fn(),
}));

describe("authenticateRequest", () => {
  it("should return authentication data if apiKey is valid", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "valid-api-key" },
    });
    vi.mocked(getEnvironmentIdFromApiKey).mockResolvedValue(ok("env-id"));
    vi.mocked(hashApiKey).mockReturnValue("hashed-api-key");

    const result = await authenticateRequest(request);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        type: "apiKey",
        environmentId: "env-id",
        hashedApiKey: "hashed-api-key",
      });
    }
  });

  it("should return forbidden error if environmentId is not found", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "invalid-api-key" },
    });
    vi.mocked(getEnvironmentIdFromApiKey).mockResolvedValue(err({ type: "forbidden" }));

    const result = await authenticateRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ type: "forbidden" });
    }
  });

  it("should return forbidden error if environmentId is empty", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "invalid-api-key" },
    });
    vi.mocked(getEnvironmentIdFromApiKey).mockResolvedValue(ok(""));

    const result = await authenticateRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ type: "forbidden" });
    }
  });

  it("should return unauthorized error if apiKey is missing", async () => {
    const request = new Request("http://localhost");

    const result = await authenticateRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ type: "unauthorized" });
    }
  });
});
