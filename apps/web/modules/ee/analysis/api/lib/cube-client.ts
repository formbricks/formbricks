import "server-only";
import cubejs, { type Query, type ResultSet } from "@cubejs-client/core";
import { randomUUID } from "node:crypto";
import { logger } from "@formbricks/logger";
import type { TChartQuery } from "@formbricks/types/analysis";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { getOrganization } from "@/lib/organization/service";
import { withResponseBaseMeasure } from "@/modules/ee/analysis/charts/lib/response-base";
import { expandPresetDateRanges } from "@/modules/ee/analysis/lib/date-presets";
import { isRatioMeasure } from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { type TCubeQuerySource, getCubeApiConfig } from "./cube-config";
import { applyValueBandNullGuard, getCubeQueryAuditSummary, validateCubeQueryMembers } from "./cube-query";

const CUBE_QUERY_ERROR_MESSAGE =
  "Cube query failed. Verify CUBEJS_API_URL and CUBEJS_API_SECRET, and ensure the Cube service is running.";

type TScopedCubeQueryInput = {
  query: TChartQuery;
  feedbackDirectoryId: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
  source: TCubeQuerySource;
};

const queueCubeQueryAuditEvent = ({
  error,
  input,
  requestId,
  status,
}: {
  error?: unknown;
  input: TScopedCubeQueryInput;
  requestId: string;
  status: "success" | "failure";
}) => {
  const errorName = error instanceof Error ? error.name : undefined;

  void queueAuditEventWithoutRequest({
    action: "queried",
    targetType: "cubeQuery",
    userId: input.userId,
    userType: "user",
    targetId: requestId,
    organizationId: input.organizationId,
    status,
    eventId: requestId,
    newObject: {
      requestId,
      tenantId: input.feedbackDirectoryId,
      feedbackDirectoryId: input.feedbackDirectoryId,
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      userId: input.userId,
      source: input.source,
      query: getCubeQueryAuditSummary(input.query),
      ...(errorName ? { errorName } : {}),
    },
    ipAddress: UNKNOWN_DATA,
  }).catch((auditError) => {
    logger.error(auditError, "Failed to queue Cube query audit event");
  });
};

/**
 * Cube's client pivot replaces a NULL measure with a fill value, defaulting to 0 — so a survey that
 * never asked a question renders identically to one that genuinely scored zero (npsScore and
 * csatScore in the Cube schema return NULL deliberately when there is nothing to compute).
 *
 * `fillWithValue: null` does not help: the client resolves the cell as
 * `row[measure] ?? fillWithValue ?? 0`, and a null fill falls straight through that chain back to 0.
 * So fill with a sentinel no real value can collide with, then turn it back into null here.
 *
 * A granular time dimension needs both behaviours at once. `fillMissingDates` (on by default) makes
 * the pivot invent a row per empty bucket and fill it the same way, so a filled cell there is a
 * measured zero — while a filled cell in a bucket Cube actually returned is a real NULL, e.g. a day
 * with responses but no NPS answer among them. Pivoting a second time with `fillMissingDates: false`
 * lists the buckets that are real, which is enough to tell the two apart.
 */
const NULL_FILL_SENTINEL = "__formbricks_null__";

const restoreNullMeasures = (
  rows: TChartDataRow[],
  measureKeys: string[],
  /**
   * Rows this rejects were invented by the pivot to fill an empty date bucket, so their filled
   * count cells are a measured zero rather than a NULL. Defaults to treating every row as real.
   */
  isRealRow: (row: TChartDataRow) => boolean = () => true
): TChartDataRow[] => {
  // Only measure cells are ever filled, so only those may be turned back into null. A dimension
  // can legitimately hold any string a respondent typed — including this sentinel — and rewriting
  // that to null would silently drop their answer from the chart.
  const measures = new Set(measureKeys);
  if (measures.size === 0) return rows;

  return rows.map((row) => {
    const filled = Object.keys(row).filter((key) => row[key] === NULL_FILL_SENTINEL && measures.has(key));
    if (filled.length === 0) return row;

    const rowIsReal = isRealRow(row);
    const restored = { ...row };
    for (const key of filled) {
      // An invented bucket counted zero of everything, but it has no ratio: there is no NPS for a
      // day nobody answered, and zeroing it plots a real score of 0 (equal promoters and
      // detractors) on every empty day, dragging the line to the baseline between the days that
      // do have answers. Ratios stay null there so the line breaks instead.
      restored[key] = rowIsReal || isRatioMeasure(key) ? null : 0;
    }
    return restored;
  });
};

/**
 * True when Cube's error names a member that was injected into `executed` on top of `plain` — the
 * "Member 'FeedbackRecords.npsCount' not found" a schema without that measure answers with.
 */
const isInjectedMemberRejection = (error: unknown, executed: TChartQuery, plain: TChartQuery): boolean => {
  const plainMeasures = new Set(plain.measures ?? []);
  const injected = (executed.measures ?? []).filter((measure) => !plainMeasures.has(measure));
  if (injected.length === 0) return false;
  const message = error instanceof Error ? error.message : String(error);
  return injected.some((measure) => message.includes(measure));
};

export async function executeTenantScopedQuery(input: TScopedCubeQueryInput) {
  try {
    validateCubeQueryMembers(input.query);
  } catch (error) {
    queueCubeQueryAuditEvent({ error, input, requestId: randomUUID(), status: "failure" });
    logger.warn(error, "Cube query validation failed");
    throw error;
  }

  const tenantScope = {
    feedbackDirectoryId: input.feedbackDirectoryId,
    workspaceId: input.workspaceId,
    organizationId: input.organizationId,
    userId: input.userId,
    source: input.source,
  };
  let apiUrl: string;
  let requestId: string;
  let token: string;

  try {
    ({ apiUrl, requestId, token } = getCubeApiConfig(tenantScope));
  } catch (error) {
    queueCubeQueryAuditEvent({ error, input, requestId: randomUUID(), status: "failure" });
    logger.error(error, "Cube query configuration failed");
    throw error;
  }

  // Calendar days in the query are cut in the organization's reporting zone (see `@/lib/date-ranges`),
  // the same zone the survey summary filter uses, so a chart and the Summary tab agree on a window.
  let timeZone: string;
  try {
    const organization = await getOrganization(input.organizationId);
    timeZone = getReportingTimeZone(organization?.displayTimeZone);
  } catch (error) {
    queueCubeQueryAuditEvent({ error, input, requestId, status: "failure" });
    logger.error(error, "Cube query time zone lookup failed");
    throw error;
  }

  try {
    const client = cubejs(token, { apiUrl });
    // What Cube runs can differ from what the caller asked for: the response base count rides along
    // (charts show "Based on N answers" without a second round trip) and the NULL value band is
    // dropped. The audit event and the granular time dimension still come from `input.query`,
    // which is the chart as saved.
    const plainQuery = applyValueBandNullGuard(input.query);
    let executedQuery = applyValueBandNullGuard(withResponseBaseMeasure(input.query));
    // Cube 1.7 serializes every numeric result as a JSON string, dimensions included (an average
    // arrives as "7.333333333333333", a Value (Number) of 3 as "3"), and strings skip the number
    // formatting charts and tables apply. castNumerics turns back into numbers exactly the members
    // the response annotates as `number`; string members such as a text answer of "123", and nulls,
    // are left alone.
    const load = (query: TChartQuery) =>
      client.load(expandPresetDateRanges(query, timeZone) as Query, { castNumerics: true });
    let resultSet: ResultSet;
    try {
      resultSet = await load(executedQuery);
    } catch (error) {
      // The base is a courtesy, never a reason for the chart itself to fail. A self-hosted Cube whose
      // schema predates the count (the Docker install keeps the schema on the host and upgrades do not
      // refresh it) rejects the injected member by name, so run the chart as saved instead. Only that
      // rejection earns a retry: a timeout or a failure in the chart's own members would fail again
      // and merely double the load on a Cube that is already struggling.
      if (!isInjectedMemberRejection(error, executedQuery, plainQuery)) throw error;
      logger.warn(error, "Cube rejected the response base measure; retrying without it");
      executedQuery = plainQuery;
      resultSet = await load(executedQuery);
    }
    // The injected count is a measure too: an invented date bucket must read 0 answers, not NULL.
    const measures = executedQuery.measures ?? [];
    const granular = (input.query.timeDimensions ?? []).filter((td) => Boolean(td.granularity));
    const filled = resultSet.tablePivot({ fillWithValue: NULL_FILL_SENTINEL });

    // The pivot only invents rows for empty buckets when there is exactly one granular time
    // dimension (see NULL_FILL_SENTINEL); with none, or several, every row it returns is real.
    let result: TChartDataRow[];
    if (granular.length === 1) {
      const bucketKey = `${granular[0].dimension}.${granular[0].granularity}`;
      const realBuckets = new Set(
        resultSet
          .tablePivot({ fillMissingDates: false, fillWithValue: NULL_FILL_SENTINEL })
          .map((row) => String(row[bucketKey]))
      );
      result = restoreNullMeasures(filled, measures, (row) => realBuckets.has(String(row[bucketKey])));
    } else {
      result = restoreNullMeasures(filled, measures);
    }
    queueCubeQueryAuditEvent({ input, requestId, status: "success" });
    return result;
  } catch (error) {
    queueCubeQueryAuditEvent({ error, input, requestId, status: "failure" });
    logger.error(error, "Cube query failed");

    throw new Error(CUBE_QUERY_ERROR_MESSAGE);
  }
}
