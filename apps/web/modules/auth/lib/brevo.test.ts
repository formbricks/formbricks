import { validateInputs } from "@/lib/utils/validate";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { createBrevoCustomer, updateBrevoCustomer } from "./brevo";

vi.mock("@/lib/constants", () => ({
  BREVO_API_KEY: "mock_api_key",
  BREVO_LIST_ID: "123",
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

global.fetch = vi.fn();

describe("createBrevoCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return early if BREVO_API_KEY is not defined", async () => {
    vi.doMock("@/lib/constants", () => ({
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

    expect(validateInputs).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(expect.any(Error), "Error sending user to Brevo");
  });

  test("should log the error response if fetch status is not 201", async () => {
    const loggerSpy = vi.spyOn(logger, "error");

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new global.Response("Bad Request", { status: 400, statusText: "Bad Request" })
    );

    await createBrevoCustomer({ id: "123", email: "test@example.com" });

    expect(validateInputs).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith({ errorText: "Bad Request" }, "Error sending user to Brevo");
  });
});

describe("updateBrevoCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return early if BREVO_API_KEY is not defined", async () => {
    vi.doMock("@/lib/constants", () => ({
      BREVO_API_KEY: undefined,
      BREVO_LIST_ID: "123",
    }));

    const { updateBrevoCustomer } = await import("./brevo"); // Re-import to get the mocked version

    const result = await updateBrevoCustomer({ id: "user123", email: "test@example.com" });

    expect(result).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(validateInputs).not.toHaveBeenCalled();
  });

  test("should log an error if fetch fails", async () => {
    const loggerSpy = vi.spyOn(logger, "error");

    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Fetch failed"));

    await updateBrevoCustomer({ id: "user123", email: "test@example.com" });

    expect(validateInputs).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(expect.any(Error), "Error updating user in Brevo");
  });

  test("should log the error response if fetch status is not 204", async () => {
    const loggerSpy = vi.spyOn(logger, "error");

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new global.Response("Bad Request", { status: 400, statusText: "Bad Request" })
    );

    await updateBrevoCustomer({ id: "user123", email: "test@example.com" });

    expect(validateInputs).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith({ errorText: "Bad Request" }, "Error updating user in Brevo");
  });

  test("should successfully update a Brevo customer", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new global.Response(null, { status: 204 }));

    await updateBrevoCustomer({ id: "user123", email: "test@example.com" });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/contacts/user123?identifierType=ext_id",
      expect.objectContaining({
        method: "PUT",
        headers: {
          Accept: "application/json",
          "api-key": "mock_api_key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attributes: { EMAIL: "test@example.com" },
        }),
      })
    );
    expect(validateInputs).toHaveBeenCalled();
  });
});
