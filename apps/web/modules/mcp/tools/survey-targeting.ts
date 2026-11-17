import type { AuthInfo, CallToolResult } from "@modelcontextprotocol/server";
import type { TMcpPermissionRequirement } from "../permissions";
import { isRecord, redactUnlessCallerHolds } from "./redacted-result";

/**
 * An app survey's `targeting` is its segment's filters, which carry literal contact attribute values (an
 * email, a plan). `list_segments` returns the same filters only to a caller with Segments and Contact
 * attributes at Read, so a survey tool returns `targeting` only to such a caller too, and leaves it out
 * for anyone else, rather than refusing a tool that Surveys: Read reaches. Left out, not set to `null`:
 * `patch_survey` keeps an omitted field, so sending a survey back as read never clears its targeting.
 * Over MCP only; the REST operations are unchanged.
 */
const TARGETING_READS: readonly TMcpPermissionRequirement[] = [
  { permission: "segments", level: "read" },
  { permission: "contactAttributes", level: "read" },
];

const withoutTargeting = (survey: unknown): unknown => {
  if (!isRecord(survey) || !("targeting" in survey)) return survey;
  const rest = { ...survey };
  delete rest.targeting;
  return rest;
};

/**
 * A survey tool's result as `authInfo` may read it: unchanged for a caller holding Segments and Contact
 * attributes at Read, and otherwise without the `targeting` of each survey it carries (`data`, a survey or
 * a list of them). An error result passes through.
 */
export const surveyResultForCaller = (
  authInfo: AuthInfo | undefined,
  result: CallToolResult
): CallToolResult => redactUnlessCallerHolds(authInfo, TARGETING_READS, result, withoutTargeting);
