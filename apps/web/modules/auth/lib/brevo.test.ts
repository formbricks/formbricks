import { Response } from "node-fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { createBrevoCustomer } from "./brevo";

vi.mock("@formbricks/lib/constants", () => ({
  BREVO_API_KEY: "mock_api_key",
  BREVO_LIST_ID: "123",
}));

vi.mock("@formbricks/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

global.fetch = vi.fn();

describe("createBrevoCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return early if BREVO_API_KEY is not defined", async () => {
    vi.doMock("@formbricks/lib/constants", () => ({
      BREVO_API_KEY: undefined,
      BREVO_LIST_ID: "123",
    }));

    const { createBrevoCustomer } = await import("./brevo");

    const result = await createBrevoCustomer({ id: "123", email: "test@example.com" });

    expect(result).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(validateInputs).not.toHaveBeenCalled();
  });

  it("should log an error if fetch fails", async () => {
    const consoleSpy = vi.spyOn(console, "error");

    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Fetch failed"));

    await createBrevoCustomer({ id: "123", email: "test@example.com" });

    expect(consoleSpy).toHaveBeenCalledWith("Error sending user to Brevo:", expect.any(Error));
  });

  it("should log the error response if fetch status is not 200", async () => {
    const consoleSpy = vi.spyOn(console, "error");

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response("Bad Request", { status: 400, statusText: "Bad Request" })
    );

    await createBrevoCustomer({ id: "123", email: "test@example.com" });

    expect(consoleSpy).toHaveBeenCalledWith("Error sending user to Brevo:", "Bad Request");
  });
});
