import { describe, expect, test } from "vitest";
import { ResponseAlreadyFinishedError, isExpectedError } from "./errors";

describe("ResponseAlreadyFinishedError", () => {
  test("is an expected 400 that names the response", () => {
    const error = new ResponseAlreadyFinishedError("response-1");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ResponseAlreadyFinishedError");
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("Response with ID response-1 is already finished");
    expect(isExpectedError(error)).toBe(true);
  });
});
