import z from "zod";
import { ValidationError } from "@formbricks/errors";

type ValidationPair = [any, z.ZodSchema<any>];

export const validateInputs = (...pairs: ValidationPair[]): void => {
  for (const [value, schema] of pairs) {
    try {
      schema.parse(value);
    } catch (error: any) {
      throw new ValidationError("Validation failed");
    }
  }
};
