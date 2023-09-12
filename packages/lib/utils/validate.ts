import z from "zod";
import { ValidationError } from "@formbricks/types/v1/errors";

type ValidationPair = [any, z.ZodSchema<any>];

export const validateInputs = (...pairs: ValidationPair[]): void => {
  for (const [value, schema] of pairs) {
    const inputValidation = schema.safeParse(value);

    if (!inputValidation.success) {
      console.error(`Validation failed for ${schema}: ${inputValidation.error.message}`);
      throw new ValidationError("Validation failed");
    }
  }
};
