import { z } from "zod";
import {
  zBannerContent,
  zBannerStyling,
  zCreateCreativeRequestBase,
  zCreativeDisplayStatus,
  zCreativeLanguageInput,
  zCreativeType,
  zFeedbackButtonContent,
  zFeedbackButtonStyling,
} from "@formbricks/api-v3-schemas";
import {
  ZV3CreateCreativeBody,
  ZV3CreativeStatsQuery,
  ZV3PatchCreativeBody,
  ZV3PauseCreativesBody,
} from "@/app/api/v3/creatives/lib/schemas";
import { lengthBoundedArray } from "@/app/api/v3/lib/bounded-array";

/**
 * Input schemas for the creative tools (ENG-4004), one file per resource like `workflow-schemas.ts`;
 * what the tools answer with is in `creative-output-schemas.ts`.
 *
 * Every schema is strict, so an argument a tool does not declare is a loud error rather than a silently
 * discarded one — see the note at the top of `schemas.ts` (ENG-2256). The contract's own schemas are
 * generated strict all the way down, which is what lets `schemas.test.ts` hold this file to the same bar.
 *
 * The write inputs are built from the generated v3 schemas, never retyped: a hand-written copy would be a
 * second contract that drifts from the one the REST routes enforce.
 */

const MCP_MAX_FILTER_VALUES = 10;
const MCP_MAX_LANGUAGES = 50;

const idField = (description: string) => z.cuid2().describe(description);

export const ZMcpListCreativesInput = z.strictObject({
  workspaceId: idField("Workspace ID whose creatives should be listed."),
  // Capped below the API's 250: a creative carries its whole content and look, so a larger page costs an
  // agent's context more than it saves. 50 still holds a whole workspace for the usual case.
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Maximum number of creatives to return. Defaults to 20."),
  cursor: z
    .string()
    .min(1)
    .optional()
    .describe("Opaque pagination cursor from a previous list_creatives response."),
  filter: z
    .strictObject({
      name: z
        .strictObject({
          contains: z.string().max(512).optional().describe("Case-insensitive creative name substring."),
        })
        .describe("Filter by creative name.")
        .optional(),
      type: z
        .strictObject({
          in: lengthBoundedArray(zCreativeType, {
            max: MCP_MAX_FILTER_VALUES,
            description: "Creative types to include: feedbackButton or banner.",
          }).optional(),
        })
        .describe("Filter by creative type.")
        .optional(),
      displayStatus: z
        .strictObject({
          in: lengthBoundedArray(zCreativeDisplayStatus, {
            max: MCP_MAX_FILTER_VALUES,
            description:
              "Derived statuses to include (draft, scheduled, active, paused, closed, archived). Omit for every status but archived.",
          }).optional(),
        })
        .describe("Filter by what each creative is doing now.")
        .optional(),
    })
    .describe("Optional supported v3 creative filters.")
    .optional(),
  surveyId: z.cuid2().optional().describe("Only creatives whose Destination is this survey."),
  sortBy: z
    .enum(["updatedAt", "createdAt", "name"])
    .optional()
    .describe(
      "Sort order: updatedAt and createdAt newest first, name alphabetically. Defaults to updatedAt."
    ),
});
export type TMcpListCreativesInput = z.infer<typeof ZMcpListCreativesInput>;

/** The five tools that act on one creative and take nothing else share this input. */
export const ZMcpCreativeIdInput = z.strictObject({
  creativeId: idField("Creative ID."),
});
export type TMcpCreativeIdInput = z.infer<typeof ZMcpCreativeIdInput>;

/**
 * What a client sees of `create_creative`'s input. `ZMcpCreateCreativeInput` is this, validated by the v3
 * create body.
 *
 * `type` selects the shape of `content` and `styling`, which is a discriminated union in the contract —
 * and a union cannot be a tool's root, because model providers reject a top-level `anyOf`/`oneOf`. So the
 * advertised input is one flat object carrying both shapes' fields.
 *
 * It spreads the `.shape` of the generated base rather than retyping its fields: the base is the
 * contract's list of what every create takes, and `content` and `styling` are the two it leaves to the type.
 */
export const ZMcpCreateCreativeFields = z.strictObject({
  ...zCreateCreativeRequestBase.shape,
  workspaceId: zCreateCreativeRequestBase.shape.workspaceId.describe(
    "Workspace ID the creative is created in."
  ),
  name: zCreateCreativeRequestBase.shape.name.describe(
    "Internal name, shown in the admin list; visitors never see it."
  ),
  type: zCreateCreativeRequestBase.shape.type.describe(
    "feedbackButton (a tab on a page edge) or banner (a bar at the top or bottom). It selects the shape of `content` and `styling` and can never change."
  ),
  status: zCreateCreativeRequestBase.shape.status.describe(
    "Created as draft unless set. inProgress publishes it, which needs its Destination and default-language text."
  ),
  defaultLanguage: zCreateCreativeRequestBase.shape.defaultLanguage.describe(
    "Locale code of the text a visitor sees when theirs is missing. Defaults to en-US."
  ),
  languages: lengthBoundedArray(zCreativeLanguageInput, {
    max: MCP_MAX_LANGUAGES,
    description:
      "Locale codes the texts are also written in. Every non-default key used in `content` must be listed.",
  }).optional(),
  destination: zCreateCreativeRequestBase.shape.destination.describe(
    "What pressing the creative opens: { type: survey, surveyId } or { type: link, url }. A published creative needs one, except a banner without a button."
  ),
  distribution: zCreateCreativeRequestBase.shape.distribution.describe(
    "Where and to whom it shows: showOn (pageView or action), triggers, Show when conditions and displayPercentage."
  ),
  schedule: zCreateCreativeRequestBase.shape.schedule.describe(
    "Optional startAt and endAt, as ISO 8601 instants."
  ),
  content: z
    .union([zFeedbackButtonContent, zBannerContent])
    .describe(
      'The texts, keyed by locale code (for example {"en-US": "Feedback"}). Its shape follows `type`.'
    ),
  styling: z
    .union([zFeedbackButtonStyling, zBannerStyling])
    .optional()
    .describe("Placement and theme. Its shape follows `type`; omit it for the defaults."),
});

/**
 * The v3 create body, the very schema the REST route enforces, validates the flat object behind the
 * scenes, so a `content` that does not fit the `type` is refused at the SDK before any handler runs,
 * naming the offending field, and the handler receives the parsed body the operation takes.
 *
 * A transform rather than `.pipe(ZV3CreateCreativeBody)`: the flat object's output type is not
 * assignable to the discriminated union's input, and a cast would hide the day the two drift.
 */
export const ZMcpCreateCreativeInput = ZMcpCreateCreativeFields.transform((fields, ctx) => {
  const parsed = ZV3CreateCreativeBody.safeParse(fields);
  if (parsed.success) return parsed.data;

  for (const issue of parsed.error.issues) {
    ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
  }
  return z.NEVER;
});
export type TMcpCreateCreativeInput = z.infer<typeof ZMcpCreateCreativeInput>;

export const ZMcpPatchCreativeInput = z.strictObject({
  creativeId: idField("Creative ID to update."),
  data: ZV3PatchCreativeBody.describe(
    "Partial update. Each group you send (content, styling, destination, distribution, schedule, or defaultLanguage with languages) replaces the stored group as a whole; omit a group to leave it."
  ),
});
export type TMcpPatchCreativeInput = z.infer<typeof ZMcpPatchCreativeInput>;

export const ZMcpGetCreativeStatsInput = ZV3CreativeStatsQuery.extend({
  creativeId: idField("Creative ID whose Impressions and Clicks to read."),
  from: ZV3CreativeStatsQuery.shape.from.describe(
    "First UTC day, YYYY-MM-DD. Defaults to 29 days before `to`."
  ),
  to: ZV3CreativeStatsQuery.shape.to.describe(
    "Last UTC day, inclusive, YYYY-MM-DD. Defaults to today (UTC). The range is at most 366 days."
  ),
  groupBy: ZV3CreativeStatsQuery.shape.groupBy.describe(
    "page adds the by-page table (top 100 pages by Impressions, the rest under (other)); device adds phone, tablet and desktop. Omit for totals and days only."
  ),
});
export type TMcpGetCreativeStatsInput = z.infer<typeof ZMcpGetCreativeStatsInput>;

export const ZMcpPauseCreativesInput = ZV3PauseCreativesBody.extend({
  workspaceId: idField("Workspace ID the survey belongs to."),
  surveyId: idField("Survey ID whose In progress creatives should all be paused."),
});
export type TMcpPauseCreativesInput = z.infer<typeof ZMcpPauseCreativesInput>;
