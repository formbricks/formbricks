import "server-only";
import { listTaxonomyFields } from "@/modules/hub/service";
import type { FeedbackRecordData } from "@/modules/hub/types";

/**
 * Aggregated, header-level stats for a single dataset (Hub tenant). Every field is nullable because
 * the Hub is an external service the record view must tolerate being unreachable — a null renders as
 * "—" rather than failing the page (locked decision #3).
 */
export interface TFeedbackDatasetOverview {
  recordCount: number | null;
  sourceCount: number | null;
  topicFieldCount: number | null;
  lastCollectedAt: string | null;
}

/**
 * Distinct source types present in a dataset, used to populate the Records view's Source filter.
 * Derived from the taxonomy fields (each field carries its owning `source_type`), so the options
 * reflect what has actually been collected rather than the configured feedback sources.
 */
export interface TDatasetSourceOption {
  sourceType: string;
}

const buildSourceKey = (field: { source_type: string; source_id: string }): string =>
  `${field.source_type}::${field.source_id}`;

/**
 * Computes the overview header stats and the Source-filter options for a dataset in a single Hub
 * call. `firstRecord` is the newest record from the already-fetched SSR page (records come back
 * sorted by `collected_at` desc), reused here to avoid a second list request just for the timestamp.
 *
 * Tolerates Hub errors: when the taxonomy call fails, the counts fall back to null (rendered as "—")
 * and the source options are empty, but the record table still renders from its own data.
 */
export const getFeedbackDatasetOverview = async (
  tenantId: string,
  firstRecord: FeedbackRecordData | null
): Promise<{ overview: TFeedbackDatasetOverview; sourceOptions: TDatasetSourceOption[] }> => {
  const lastCollectedAt = firstRecord?.collected_at ?? null;

  const taxonomyResult = await listTaxonomyFields(tenantId);
  if (taxonomyResult.error || !taxonomyResult.data) {
    return {
      overview: {
        recordCount: null,
        sourceCount: null,
        topicFieldCount: null,
        lastCollectedAt,
      },
      sourceOptions: [],
    };
  }

  const fields = taxonomyResult.data.data;
  const recordCount = fields.reduce((sum, field) => sum + (field.record_count ?? 0), 0);
  const distinctSources = new Set(fields.map(buildSourceKey));
  const distinctSourceTypes = Array.from(new Set(fields.map((field) => field.source_type))).sort((a, b) =>
    a.localeCompare(b)
  );

  return {
    overview: {
      recordCount,
      sourceCount: distinctSources.size,
      topicFieldCount: fields.length,
      lastCollectedAt,
    },
    sourceOptions: distinctSourceTypes.map((sourceType) => ({ sourceType })),
  };
};
