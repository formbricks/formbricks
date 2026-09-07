import { describe, expect, test } from "vitest";
import { AUTHZED_ERROR_CODES } from "../lib/authzed/errors";
import { INVALID_CONFIGURATION_RESULT, INVALID_REQUEST_RESULT } from "./authzed-schema-results";

describe("authzed schema script results", () => {
  test("keeps the argument error code aligned with the AuthZed error contract", () => {
    expect(INVALID_REQUEST_RESULT.code).toBe(AUTHZED_ERROR_CODES.INVALID_REQUEST);
  });

  test("keeps the configuration error code aligned with the AuthZed error contract", () => {
    expect(INVALID_CONFIGURATION_RESULT.code).toBe(AUTHZED_ERROR_CODES.INTERNAL);
  });
});
