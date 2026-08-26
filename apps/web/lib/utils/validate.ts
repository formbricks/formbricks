import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ValidationError } from "@formbricks/types/errors";

type ValidationPair<T> = [T, z.ZodType<T>];

function getValuePreview(value: unknown): string {
  try {
    const serializedValue = JSON.stringify(value);
    return (serializedValue ?? String(value)).substring(0, 100);
  } catch {
    try {
      return String(value).substring(0, 100);
    } catch {
      return "[unserializable]";
    }
  }
}

export function validateInputs<T extends ValidationPair<any>[]>(
  ...pairs: T
): { [K in keyof T]: T[K] extends ValidationPair<infer U> ? U : never } {
  const parsedData: any[] = [];

  for (const [value, schema] of pairs) {
    const inputValidation = schema.safeParse(value);
    if (!inputValidation.success) {
      const zodDetails = inputValidation.error.issues
        .map((issue) => {
          const path = issue?.path?.join(".") ?? "";
          return `${path}${issue.message}`;
        })
        .join("; ");

      logger.error(
        {
          error: inputValidation.error,
          issues: inputValidation.error.issues,
          valuePreview: getValuePreview(value),
        },
        "Input validation failed"
      );
      // Attach the ZodError as `cause` so callers (e.g. the v3 API error mappers) can report the
      // offending field paths rather than only this flattened message.
      throw new ValidationError(`Validation failed: ${zodDetails}`, { cause: inputValidation.error });
    }
    parsedData.push(inputValidation.data);
  }

  return parsedData as { [K in keyof T]: T[K] extends ValidationPair<infer U> ? U : never };
}
