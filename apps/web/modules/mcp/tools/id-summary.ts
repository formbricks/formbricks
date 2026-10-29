import type { CallToolResult } from "@modelcontextprotocol/server";
import type { z } from "zod";

/**
 * Replace the text a client shows the model with one built from ids, counts and fixed words.
 *
 * `structuredContent` keeps the full result, names included, because a name is data the agent was asked to
 * read. The text half goes into the model's context as if the person had said it, and workspace,
 * organization and team names are written by other people (ADR 0017), so it carries none. An error result
 * is returned untouched. A body that does not match the shape gets a fixed sentence, never the raw JSON,
 * which would put those names in front of the model.
 */
export function withIdSummary<TData>(
  result: CallToolResult,
  schema: z.ZodType<TData>,
  summarize: (data: TData) => string
): CallToolResult {
  if (result.isError) return result;
  const body = result.structuredContent as { data?: unknown } | undefined;
  const parsed = schema.safeParse(body?.data);
  if (!parsed.success) {
    return { ...result, content: [{ type: "text", text: "Done. The result is in structuredContent." }] };
  }

  return { ...result, content: [{ type: "text", text: summarize(parsed.data) }] };
}

export const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;
