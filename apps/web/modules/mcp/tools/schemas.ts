import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZSurveyFilters, ZSurveyStatus, ZSurveyType } from "@formbricks/types/surveys/types";
import {
  MAX_FEEDBACK_RECORDS_PER_BATCH,
  ZV3FeedbackRecordCreateBodyFields,
  ZV3FeedbackRecordCreateBodyStrict,
  ZV3FeedbackRecordFilters,
  ZV3FeedbackRecordListFilters,
  ZV3FeedbackRecordSearchFilters,
  ZV3FeedbackRecordSimilarityFilters,
  ZV3FeedbackRecordUpdateBodyFields,
} from "@/app/api/v3/feedbackRecords/lib/schemas";

/**
 * Every schema here is `.strict()`, so an argument a tool does not declare is a loud error instead of a
 * silently discarded one (ENG-2256).
 *
 * This has teeth only since the SDK v2 migration. v1 was handed a raw `.shape` and rebuilt it via
 * `objectFromShape()`, which dropped any unknown-keys policy — so `.strict()` here would have been
 * decorative and a misspelled argument was stripped before our code ran. On a *filter* that failed in
 * the dangerous direction: `count_feedback_records` with the pre-#8650 spelling `userId` returned the
 * count for every record in the dataset rather than that user's, and reported success, so the agent had
 * no signal it had been handed the wrong number. v2 validates the schema instance itself, so strictness
 * is now enforced where it is declared.
 *
 * The cost, accepted deliberately: `additionalProperties: false` is advertised on every tool, so a
 * client that adds its own keys to `arguments` is rejected rather than tolerated.
 *
 * **Structured sub-objects are strict too, not just the outer one.** `.strict()` binds a single object,
 * so `filter` and its `name`/`status`/`type` children each need it as well — otherwise the same bug
 * reopens one level down, and worse, quietly: a misspelled `filter.status.include` is dropped, leaves
 * `filter.status` as `{}`, and the query runs unfiltered while reporting success. Raised in review on
 * #8859 after the first version of this change only did the outer objects.
 *
 * What still accepts an arbitrary nested shape, deliberately: the free-form `z.record` fields (`blocks`,
 * `metadata`, `welcomeCard`, and the `data` payloads), which the v3 survey document contract validates
 * once the call reaches the operation.
 *
 * What still accepts one *undeliberately*: everything below `definition` on the two workflow tools. That
 * subtree is `ZWorkflowDefinition` from `packages/workflows`, shared with the v3 Workflows REST route and
 * the builder, so it is not this layer's to tighten — see the note in `./workflow-schemas.ts` (ENG-2437).
 * It is the one remaining hole, and `./schemas.test.ts` holds it there: every other structured object in
 * every MCP tool schema, at any depth, must be strict or the suite fails.
 *
 * Adding a schema? Add `.strict()` with it — and to every structured object nested inside it. Prefer
 * `z.strictObject({...})` for the nested ones: `.strict()` returns a clone that drops `.describe()`, so
 * appending it after a `.describe()` silently deletes the description the model reads.
 *
 * Array *elements* count as nested objects too — see `ZMcpCreateFeedbackRecordsInput.records`, where the
 * strictness has to come from the element schema rather than the array.
 *
 * And do not turn on @posthog/mcp's `context` injection (`lib/posthog/mcp-tracing.ts` keeps it off): it
 * injects a `context` argument into every tool's advertised schema, which these schemas would reject.
 */

export const ZMcpListSurveysInput = z
  .object({
    workspaceId: ZId.describe("Workspace ID whose surveys should be listed."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .describe("Maximum number of surveys to return. Defaults to 20.")
      .default(20),
    cursor: z
      .string()
      .min(1)
      .optional()
      .describe("Opaque pagination cursor from a previous list_surveys response."),
    includeTotalCount: z
      .boolean()
      .describe(
        "Whether to include the total matching survey count in the response metadata. Defaults to true."
      )
      .default(true),
    filter: z
      .object({
        name: z
          .strictObject({
            contains: z.string().max(512).optional().describe("Case-insensitive survey name substring."),
          })
          .describe("Filter by survey name.")
          .optional(),
        status: z
          .strictObject({
            in: z
              .array(ZSurveyStatus)
              .optional()
              .describe("Survey statuses to include, for example draft or inProgress."),
          })
          .describe("Filter by survey status.")
          .optional(),
        type: z
          .strictObject({
            in: z.array(ZSurveyType).optional().describe("Survey types to include, for example link."),
          })
          .describe("Filter by survey type.")
          .optional(),
      })
      .strict()
      .describe("Optional supported v3 survey filters.")
      .optional(),
    sortBy: ZSurveyFilters.shape.sortBy
      .optional()
      .describe("Sort field for pagination. Defaults to the v3 API default of updatedAt."),
  })
  .strict();

export const ZMcpGetSurveyInput = z
  .object({
    surveyId: z.cuid2().describe("Survey ID to fetch."),
    lang: z
      .array(z.string().trim().min(1))
      .optional()
      .describe("Optional language codes or configured aliases used to filter translatable survey fields."),
  })
  .strict();

const ZMcpSurveyLanguageInput = z.strictObject({
  code: z.string().trim().min(1).describe("Language code or configured language alias."),
  default: z.boolean().optional().describe("Whether this language is the default language."),
  enabled: z.boolean().optional().describe("Whether this language is enabled."),
});

const ZMcpObjectInput = z.record(z.string(), z.unknown());

export const ZMcpCreateSurveyInput = z
  .object({
    workspaceId: ZId.describe("Workspace ID where the survey should be created."),
    name: z.string().trim().min(1).describe("Survey name."),
    type: z.literal("link").optional().describe("Survey type. Only link surveys are supported."),
    status: ZSurveyStatus.optional().describe("Initial survey status. Defaults to draft."),
    defaultLanguage: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Default language code or configured language alias. Defaults to en-US."),
    metadata: ZMcpObjectInput.optional().describe("Survey metadata using the v3 survey document contract."),
    languages: z
      .array(ZMcpSurveyLanguageInput)
      .optional()
      .describe("Configured survey languages using the v3 survey document contract."),
    welcomeCard: ZMcpObjectInput.optional().describe("Welcome card using the v3 survey document contract."),
    blocks: z.array(ZMcpObjectInput).min(1).describe("Survey blocks using the v3 survey document contract."),
    endings: z
      .array(ZMcpObjectInput)
      .optional()
      .describe("Survey endings using the v3 survey document contract."),
    hiddenFields: ZMcpObjectInput.optional().describe("Hidden fields using the v3 survey document contract."),
    variables: z
      .array(ZMcpObjectInput)
      .optional()
      .describe("Survey variables using the v3 survey document contract."),
  })
  .strict();

export const ZMcpPatchSurveyInput = z
  .object({
    surveyId: z.cuid2().describe("Survey ID to update."),
    data: z
      .record(z.string(), z.unknown())
      .describe(
        "Strict top-level v3 survey patch payload. Omitted top-level fields are preserved; provided objects and arrays replace that whole subtree."
      ),
  })
  .strict();

export const ZMcpValidateSurveyInput = z
  .object({
    operation: z.enum(["create", "patch"]).describe("Validation operation to run."),
    surveyId: z.cuid2().optional().describe("Survey ID to validate against. Required for patch validation."),
    data: ZMcpObjectInput.describe(
      "Create or patch payload to validate using the v3 survey document contract."
    ),
  })
  .strict();

export const ZMcpDeleteSurveyInput = z
  .object({
    surveyId: z.cuid2().describe("Survey ID to delete."),
  })
  .strict();

// list_workspaces takes no arguments — it returns the workspaces the authenticated caller can access.
//
// The one schema where `.strict()` buys no ENG-2256 protection: with no declared keys there is nothing to
// misspell, so this is uniformity rather than a fix. Kept strict anyway, as a deliberate call rather than an
// oversight, but the asymmetry is worth knowing if a client ever trips on it. It advertises
// `{"type":"object","properties":{},"additionalProperties":false}`, and a client that pads a zero-argument
// call with a placeholder key would now fail here where v1 dropped it — costly out of proportion, because
// this is the discovery tool every workspace-scoped tool takes its `workspaceId` from, so losing it looks
// like the whole server being broken. Raised in review on #8859; no such client is confirmed, and our own
// QA only exercises Claude Code, so treat a report of "the Formbricks MCP server won't connect" from
// another client as a reason to look here first.
export const ZMcpListWorkspacesInput = z.object({}).strict();

// Feedback records live in the Hub, addressed by a tenant that is always resolved server-side from the
// caller's workspace + feedback dataset. No schema here accepts a tenant_id; the Hub's `tenant_id` is
// surfaced outward as `dataset_id`.
const datasetIdField = ZId.optional().describe(
  "Feedback dataset to target. Optional when the workspace has exactly one active dataset; required when it has more than one. Use list_feedback_datasets to discover ids."
);

export const ZMcpListFeedbackDatasetsInput = z
  .object({
    workspaceId: ZId.describe("Workspace ID whose feedback datasets should be listed."),
  })
  .strict();

export const ZMcpListFeedbackRecordsInput = ZV3FeedbackRecordListFilters.extend({
  workspaceId: ZId.describe("Workspace ID whose feedback records should be listed."),
  datasetId: datasetIdField,
}).strict();

export const ZMcpGetFeedbackRecordInput = z
  .object({
    workspaceId: ZId.describe("Workspace ID that owns the feedback record."),
    feedbackRecordId: z.uuid().describe("Feedback record ID (UUID) to fetch."),
    datasetId: datasetIdField,
  })
  .strict();

// Extends the plain field object rather than the refined body, so the value/field_type rule is enforced
// by the operations layer. (Before ENG-2256 that layer was also where a stripped unknown key surfaced,
// as a missing value; a misspelled key is now rejected by the SDK before the handler runs, so the
// operations layer only ever sees declared keys.)
export const ZMcpCreateFeedbackRecordInput = ZV3FeedbackRecordCreateBodyFields.extend({
  workspaceId: ZId.describe("Workspace ID to create the feedback record in."),
  datasetId: datasetIdField,
}).strict();

export const ZMcpCountFeedbackRecordsInput = ZV3FeedbackRecordFilters.extend({
  workspaceId: ZId.describe("Workspace ID whose feedback records should be counted."),
  datasetId: datasetIdField,
}).strict();

// The refined body is used here, unlike the single-record tool: an element schema is not extended with
// `workspaceId`/`datasetId` (those live on the outer object), so the refined form drops straight in and the
// value/field_type rule is enforced per element by the schema itself. The single-record tool could do the
// same — see the note there — it just doesn't need to.
export const ZMcpCreateFeedbackRecordsInput = z
  .object({
    workspaceId: ZId.describe("Workspace ID to create the feedback records in."),
    datasetId: datasetIdField,
    records: z
      // The strict variant: an unknown key *inside a record* must be rejected, not dropped. Without it
      // the outer `.strict()` below covers only the top level, so a misspelled `user_id` in a batch
      // import vanished silently — ENG-2256 in the one place it does the most damage.
      .array(ZV3FeedbackRecordCreateBodyStrict)
      .min(1)
      .max(MAX_FEEDBACK_RECORDS_PER_BATCH)
      .describe(
        `Feedback records to create, 1–${MAX_FEEDBACK_RECORDS_PER_BATCH} per call. Every record is validated before any is written, so an invalid record fails the whole call rather than storing part of the batch.`
      ),
  })
  .strict();

// The plain field object again (not the refined one), so the at-least-one-field rule is enforced by the
// operations layer. A choice, not a constraint: `refined.extend({...}).strict()` does work in Zod 4 —
// verified, including that the refinement survives both calls — so this could equally be enforced here.
// It is left in the operations layer because that is the one place both the MCP tools and the v3 REST
// routes pass through, so the rule exists once.
//
// `.strict()` here has a sharper edge than on the other tools, and deliberately so: the update set is a
// `.pick()` of eight mutable fields, so echoing back a record from `get_feedback_record` — the obvious
// read-modify-write loop — is now rejected rather than having its provenance quietly ignored. That is the
// ENG-2256 trade taken on purpose: a misspelled `value_text` would otherwise vanish and the "update" would
// silently change nothing. The rejection is recoverable (Zod's `unrecognized_keys` names every offending
// key) and the tool description tells the caller to strip them, so the loud version costs one retry where
// the quiet version cost a lost correction. Note this is the opposite call to the one made for the shared
// v3 REST body in `app/api/v3/feedbackRecords/lib/schemas.ts` — different clients: an agent re-reads the
// advertised schema and the error text on every call, a REST integration does not.
export const ZMcpUpdateFeedbackRecordInput = ZV3FeedbackRecordUpdateBodyFields.extend({
  workspaceId: ZId.describe("Workspace ID that owns the feedback record."),
  feedbackRecordId: z.uuid().describe("Feedback record ID (UUID) to update."),
  datasetId: datasetIdField,
}).strict();

export const ZMcpDeleteFeedbackRecordInput = z
  .object({
    workspaceId: ZId.describe("Workspace ID that owns the feedback record."),
    feedbackRecordId: z.uuid().describe("Feedback record ID (UUID) to delete permanently."),
    datasetId: datasetIdField,
  })
  .strict();

export const ZMcpSearchFeedbackRecordsInput = ZV3FeedbackRecordSearchFilters.extend({
  workspaceId: ZId.describe("Workspace ID whose feedback records should be searched."),
  datasetId: datasetIdField,
}).strict();

export const ZMcpFindSimilarFeedbackRecordsInput = ZV3FeedbackRecordSimilarityFilters.extend({
  workspaceId: ZId.describe("Workspace ID that owns the feedback record."),
  feedbackRecordId: z.uuid().describe("Feedback record ID (UUID) to find similar records for."),
  datasetId: datasetIdField,
}).strict();

export type TMcpListSurveysInput = z.infer<typeof ZMcpListSurveysInput>;
export type TMcpListWorkspacesInput = z.infer<typeof ZMcpListWorkspacesInput>;
export type TMcpGetSurveyInput = z.infer<typeof ZMcpGetSurveyInput>;
export type TMcpCreateSurveyInput = z.infer<typeof ZMcpCreateSurveyInput>;
export type TMcpPatchSurveyInput = z.infer<typeof ZMcpPatchSurveyInput>;
export type TMcpValidateSurveyInput = z.infer<typeof ZMcpValidateSurveyInput>;
export type TMcpDeleteSurveyInput = z.infer<typeof ZMcpDeleteSurveyInput>;
export type TMcpListFeedbackDatasetsInput = z.infer<typeof ZMcpListFeedbackDatasetsInput>;
export type TMcpListFeedbackRecordsInput = z.infer<typeof ZMcpListFeedbackRecordsInput>;
export type TMcpGetFeedbackRecordInput = z.infer<typeof ZMcpGetFeedbackRecordInput>;
export type TMcpCreateFeedbackRecordInput = z.infer<typeof ZMcpCreateFeedbackRecordInput>;
export type TMcpCountFeedbackRecordsInput = z.infer<typeof ZMcpCountFeedbackRecordsInput>;
export type TMcpCreateFeedbackRecordsInput = z.infer<typeof ZMcpCreateFeedbackRecordsInput>;
export type TMcpUpdateFeedbackRecordInput = z.infer<typeof ZMcpUpdateFeedbackRecordInput>;
export type TMcpDeleteFeedbackRecordInput = z.infer<typeof ZMcpDeleteFeedbackRecordInput>;
export type TMcpSearchFeedbackRecordsInput = z.infer<typeof ZMcpSearchFeedbackRecordsInput>;
export type TMcpFindSimilarFeedbackRecordsInput = z.infer<typeof ZMcpFindSimilarFeedbackRecordsInput>;
