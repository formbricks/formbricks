import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ValidationError } from "@formbricks/types/errors";
import { validateInputs } from "./validate";

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("validateInputs", () => {
  test("validates inputs successfully", () => {
    const schema = z.string();
    const result = validateInputs(["valid", schema]);

    expect(result).toEqual(["valid"]);
  });

  test("throws ValidationError for invalid inputs", () => {
    const schema = z.string();

    expect(() => validateInputs([123, schema])).toThrow(ValidationError);
    expect(logger.error).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("Validation failed")
    );
  });

  test("validates multiple inputs successfully", () => {
    const stringSchema = z.string();
    const numberSchema = z.number();

    const result = validateInputs(["valid", stringSchema], [42, numberSchema]);

    expect(result).toEqual(["valid", 42]);
  });

  test("throws ValidationError for one of multiple invalid inputs", () => {
    const stringSchema = z.string();
    const numberSchema = z.number();

    expect(() => validateInputs(["valid", stringSchema], ["invalid", numberSchema])).toThrow(ValidationError);
    expect(logger.error).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("Validation failed")
    );
  });
});
