import "server-only";
import { problemBadRequest } from "@/app/api/v3/lib/response";

const joinWithOr = (names: string[]): string =>
  names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : (names[0] ?? "");

/**
 * An update with nothing to change is a 400, not a silent no-op: the agent asked for something and would
 * otherwise be told it succeeded. Pass every changeable field by name; `undefined` means "not given" (a
 * `null` is a value, it clears). Returns the 400 to relay, or `null` when at least one field was given.
 */
export const rejectEmptyChange = (
  fields: Readonly<Record<string, unknown>>,
  requestId: string,
  instance: string
): Response | null => {
  const names = Object.keys(fields);
  if (names.some((name) => fields[name] !== undefined)) return null;

  return problemBadRequest(requestId, `Provide at least one of ${joinWithOr(names)}`, {
    invalid_params: [{ name: "body", reason: "Provide at least one field to change" }],
    instance,
  });
};
