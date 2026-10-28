import { z } from "zod";
import { ZIsoDateTime } from "./common";
import { ZCreateWorkflowInput } from "./inputs";

/**
 * Pull/push documents for workflows (ADR 0015): the workflow's editable state as one JSON document. The
 * envelope and the push body are the shared v3 document contract (`apps/web/app/api/v3/documents/lib/
 * envelope.ts`, one for surveys, creatives and workflows); the schemas here are this kind's view of it, so
 * the operation map and the OpenAPI spec cover the document routes like every other workflow operation.
 */

export const WORKFLOW_DOCUMENT_SCHEMA_VERSION = 1;

/**
 * Built from the create input, so it accepts exactly what a create accepts. `workspaceId` and `status` are
 * left out (a push never moves a workflow between workspaces or through its lifecycle), and so is
 * everything the server derives or owns: the trigger's `surveyId`/`triggerType`, runs, creator and
 * timestamps. A push replaces the state: an omitted `description` resets to none.
 */
export const ZWorkflowDocument = ZCreateWorkflowInput.pick({
  name: true,
  description: true,
  definition: true,
})
  .strict()
  .describe("A workflow's editable state: name, description and definition.");
export type TWorkflowDocument = z.infer<typeof ZWorkflowDocument>;

export const ZWorkflowDocumentEnvelope = z
  .strictObject({
    kind: z.literal("workflow"),
    schemaVersion: z.literal(WORKFLOW_DOCUMENT_SCHEMA_VERSION),
    id: z.cuid2(),
    workspaceId: z.cuid2(),
    updatedAt: ZIsoDateTime.describe("Send it back as `expectedUpdatedAt` when pushing."),
    document: ZWorkflowDocument,
  })
  .describe("A pulled or pushed workflow document with the identity and updatedAt it belongs to.");
export type TWorkflowDocumentEnvelope = z.infer<typeof ZWorkflowDocumentEnvelope>;

export const ZPushWorkflowDocumentInput = z
  .strictObject({
    schemaVersion: z.literal(WORKFLOW_DOCUMENT_SCHEMA_VERSION),
    expectedUpdatedAt: ZIsoDateTime.describe("The updatedAt of the envelope the document was pulled from."),
    document: ZWorkflowDocument,
    dryRun: z.boolean().optional(),
    confirmDestructive: z
      .boolean()
      .optional()
      .describe("Accepted for every document kind; a workflow push has nothing destructive to confirm."),
  })
  .describe("Replaces a workflow's editable state if it is still at expectedUpdatedAt.");
export type TPushWorkflowDocumentInput = z.infer<typeof ZPushWorkflowDocumentInput>;

export const ZPushWorkflowDocumentResult = z
  .strictObject({
    envelope: ZWorkflowDocumentEnvelope,
    dryRun: z.boolean(),
    changes: z.array(z.strictObject({ path: z.string(), change: z.enum(["added", "removed", "changed"]) })),
  })
  .describe("The document as stored afterwards (or as it would be, for a dry run) and what differs.");
export type TPushWorkflowDocumentResult = z.infer<typeof ZPushWorkflowDocumentResult>;
