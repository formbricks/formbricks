import type { z } from "zod";
import { formatZodIssues } from "@/app/api/v3/lib/api-wrapper";
import { problemBadRequest } from "@/app/api/v3/lib/response";

export type TParsedV3Body<TData> = { ok: true; data: TData } | { ok: false; response: Response };

/**
 * Parse an operation's request body against its schema. On failure `response` is the 400 problem to relay,
 * with the same `invalid_params` for a REST call and an MCP tool call, since both reach the operation with
 * the raw body. Operations call it once at the top instead of each repeating the safeParse / problem pair.
 */
export function parseV3Body<TSchema extends z.ZodType>(
  schema: TSchema,
  body: unknown,
  requestId: string,
  instance: string
): TParsedV3Body<z.infer<TSchema>> {
  const parsed = schema.safeParse(body);
  if (parsed.success) return { ok: true, data: parsed.data };

  return {
    ok: false,
    response: problemBadRequest(requestId, "Invalid request body", {
      invalid_params: formatZodIssues(parsed.error, "body"),
      instance,
    }),
  };
}
