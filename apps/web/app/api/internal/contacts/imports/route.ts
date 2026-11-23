import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import {
  CSV_IMPORT_ARRAY_BUDGET,
  CSV_IMPORT_MAX_BODY_BYTES,
} from "@/modules/ee/contacts/lib/csv-import-limits";
import { createContactImportOperation } from "../lib/operations";
import { ZContactImportBody, ZContactImportQuery } from "../schemas";

/**
 * `POST /api/internal/contacts/imports?workspaceId=`: create or update the workspace's contacts from a CSV
 * import. Contacts-licence gated.
 *
 * The body is one list of up to `CSV_IMPORT_MAX_RECORDS` records, so this is the one route that lifts the
 * wrapper's array budget (1,000 items per array), to exactly that; the depth cap still holds. The body limit
 * is the 2 MB the server action took.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZContactImportQuery, body: ZContactImportBody },
  bodyLimitBytes: CSV_IMPORT_MAX_BODY_BYTES,
  arrayBudget: CSV_IMPORT_ARRAY_BUDGET,
  action: "createdFromCSV",
  targetType: "contact",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createContactImportOperation({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
