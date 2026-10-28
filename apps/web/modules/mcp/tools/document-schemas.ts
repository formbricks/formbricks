import { z } from "zod";
import { V3_DOCUMENT_SCHEMA_VERSION, ZV3DocumentKind } from "@/app/api/v3/documents/lib/envelope";

const kindField = ZV3DocumentKind.describe(
  "What the document is: `survey`, `creative` or `workflow`. Use the same kind the document was pulled as."
);

const idField = z.cuid2().describe("ID of the survey, creative or workflow.");

export const ZMcpPullDocumentInput = z.object({ kind: kindField, id: idField }).strict();

export const ZMcpPushDocumentInput = z
  .object({
    kind: kindField,
    id: idField,
    schemaVersion: z
      .literal(V3_DOCUMENT_SCHEMA_VERSION)
      .describe("The schemaVersion of the pulled document. A push with another version is refused."),
    expectedUpdatedAt: z.iso
      .datetime({ offset: true })
      .describe(
        "The updatedAt of the pulled document. If the resource changed since, the push is refused with a 409 carrying currentUpdatedAt: pull again and redo your edit."
      ),
    document: z
      .record(z.string(), z.unknown())
      .describe(
        "The edited `document` from pull_document. It replaces the resource's editable state: omitted fields reset. Validated against the kind's document schema."
      ),
    dryRun: z
      .boolean()
      .optional()
      .describe("Run every check and return what would change without writing anything."),
    confirmDestructive: z
      .boolean()
      .optional()
      .describe(
        "Set only after the user agreed to a change that removes data (the 409 details.changes lists it). Default false."
      ),
  })
  .strict();

export type TMcpPullDocumentInput = z.infer<typeof ZMcpPullDocumentInput>;
export type TMcpPushDocumentInput = z.infer<typeof ZMcpPushDocumentInput>;
