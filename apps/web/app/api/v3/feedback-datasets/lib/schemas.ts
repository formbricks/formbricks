import { z } from "zod";
import { VIEWER_ACCESS_MAX_CONDITIONS } from "@/modules/ee/dashboard-access/lib/viewer-access-claim";
import { findRepeatedViewerConditions } from "@/modules/ee/dashboard-access/lib/viewer-access-fields";

/**
 * Request schemas of a Feedback Dataset's Dashboard Viewer access (ENG-7476), hand-written beside the spec
 * (`docs/api-v3-reference/src/paths/api_v3_feedback-datasets_{datasetId}_dashboard-viewer-access.yml`).
 */

export const ZV3FeedbackDatasetParams = z.strictObject({ datasetId: z.cuid2() });

/** Longest condition field: `ed:` and an embedded-data key. */
const MAX_FIELD_LENGTH = 300;

export const ZV3DashboardViewerAccessBody = z.strictObject({
  join: z.enum(["all", "any"]),
  conditions: z
    .array(
      z.strictObject({
        field: z.string().min(1).max(MAX_FIELD_LENGTH),
        attributeKeyId: z.cuid2().nullable(),
      })
    )
    .max(VIEWER_ACCESS_MAX_CONDITIONS)
    // A condition repeated (same field, same attribute) changes nothing; refuse it rather than store it.
    .superRefine((conditions, ctx) => {
      for (const index of findRepeatedViewerConditions(conditions)) {
        ctx.addIssue({
          code: "custom",
          path: [index],
          message: "This condition repeats an earlier one: same field and same member attribute.",
        });
      }
    }),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});
export type TV3DashboardViewerAccessBody = z.infer<typeof ZV3DashboardViewerAccessBody>;
