import { z } from "zod";
import { ZEnrichmentStatusQuery } from "@/app/api/v3/unify-feedback/enrichment-status/lib/schemas";
import {
  ZNodeIdParams,
  ZRenameNodeBody,
  ZRunIdParams,
  ZTaxonomyStateQuery,
  ZTriggerRunBody,
  requireFieldScopeParams,
} from "@/app/api/v3/unify-feedback/taxonomy/lib/schemas";

/**
 * Input schemas for the Topics & Subtopics (taxonomy) tools. Fields are taken from the v3 schemas so a
 * rule changed there reaches the tools; only the descriptions are MCP's. Every object is strict, and the
 * tenant id is never an argument: `directoryId` is checked against the workspace's own assignments.
 */

const workspaceId = ZEnrichmentStatusQuery.shape.workspaceId.describe(
  "Workspace ID. Use list_workspaces to discover ids."
);
const directoryId = ZTaxonomyStateQuery.shape.directoryId.describe(
  "Feedback dataset (directory) ID assigned to the workspace. Use list_feedback_datasets to discover ids."
);
const runId = ZRunIdParams.shape.runId.describe(
  "Taxonomy run ID, from start_taxonomy_run or get_taxonomy_state."
);
const nodeId = ZNodeIdParams.shape.nodeId.describe("Taxonomy node ID, from get_taxonomy_state.");

/** Scope fields shared by the state read and the run start, so the two cannot drift apart. */
const scopeFields = {
  scopeType: ZTaxonomyStateQuery.shape.scopeType.describe(
    "`field` (default) covers one feedback field and needs sourceType and fieldId; `directory` covers all text feedback in the dataset and takes neither."
  ),
  sourceType: ZTaxonomyStateQuery.shape.sourceType.describe(
    "Field scope only. Source type of the field, from list_taxonomy_fields."
  ),
  sourceId: ZTaxonomyStateQuery.shape.sourceId.describe(
    "Field scope only. Source id of the field, from list_taxonomy_fields. Empty string means feedback with no attributed source."
  ),
  fieldId: ZTaxonomyStateQuery.shape.fieldId.describe(
    "Field scope only. Field id, from list_taxonomy_fields."
  ),
};

export const ZMcpListTaxonomyFieldsInput = z.strictObject({ workspaceId, directoryId });

export const ZMcpGetTaxonomyStateInput = z
  .strictObject({ workspaceId, directoryId, ...scopeFields })
  .superRefine(requireFieldScopeParams);

export const ZMcpGetTaxonomyRunInput = z.strictObject({ workspaceId, directoryId, runId });

export const ZMcpGetTaxonomyRecordCountsInput = z.strictObject({ workspaceId, directoryId, runId });

export const ZMcpStartTaxonomyRunInput = z
  .strictObject({
    workspaceId,
    directoryId,
    ...scopeFields,
    fieldLabel: ZTriggerRunBody.shape.fieldLabel.describe(
      "Field scope only. Display label for the field; optional, directory runs derive their own."
    ),
  })
  .superRefine(requireFieldScopeParams);

export const ZMcpListTaxonomyNodeRecordsInput = z.strictObject({
  workspaceId,
  directoryId,
  nodeId,
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("How many records to return (default 20, max 50). A sample, not a page: there is no cursor."),
});

export const ZMcpRenameTaxonomyNodeInput = z.strictObject({
  workspaceId,
  directoryId,
  nodeId,
  label: ZRenameNodeBody.shape.label.describe("The new node label. Trimmed; must not be empty."),
});

export const ZMcpRemoveTaxonomyNodeInput = z.strictObject({ workspaceId, directoryId, nodeId });

export const ZMcpGetEnrichmentStatusInput = z.strictObject({ workspaceId });

export type TMcpListTaxonomyFieldsInput = z.infer<typeof ZMcpListTaxonomyFieldsInput>;
export type TMcpGetTaxonomyStateInput = z.infer<typeof ZMcpGetTaxonomyStateInput>;
export type TMcpGetTaxonomyRunInput = z.infer<typeof ZMcpGetTaxonomyRunInput>;
export type TMcpGetTaxonomyRecordCountsInput = z.infer<typeof ZMcpGetTaxonomyRecordCountsInput>;
export type TMcpStartTaxonomyRunInput = z.infer<typeof ZMcpStartTaxonomyRunInput>;
export type TMcpListTaxonomyNodeRecordsInput = z.infer<typeof ZMcpListTaxonomyNodeRecordsInput>;
export type TMcpRenameTaxonomyNodeInput = z.infer<typeof ZMcpRenameTaxonomyNodeInput>;
export type TMcpRemoveTaxonomyNodeInput = z.infer<typeof ZMcpRemoveTaxonomyNodeInput>;
export type TMcpGetEnrichmentStatusInput = z.infer<typeof ZMcpGetEnrichmentStatusInput>;
