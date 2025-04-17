import { Response } from "node-fetch";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { logger } from "@formbricks/logger";
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

  test("should return early if BREVO_API_KEY is not defined", async () => {
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

  test("should log an error if fetch fails", async () => {
    const loggerSpy = vi.spyOn(logger, "error");

    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Fetch failed"));

    await createBrevoCustomer({ id: "123", email: "test@example.com" });

    expect(loggerSpy).toHaveBeenCalledWith(expect.any(Error), "Error sending user to Brevo");
  });

  test("should log the error response if fetch status is not 200", async () => {
    const loggerSpy = vi.spyOn(logger, "error");

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response("Bad Request", { status: 400, statusText: "Bad Request" })
    );

    await createBrevoCustomer({ id: "123", email: "test@example.com" });

    expect(loggerSpy).toHaveBeenCalledWith({ errorText: "Bad Request" }, "Error sending user to Brevo");
  });
});
