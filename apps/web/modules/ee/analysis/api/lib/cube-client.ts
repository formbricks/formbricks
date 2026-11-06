import "server-only";
import cubejs, { type Query, type ResultSet } from "@cubejs-client/core";
import { randomUUID } from "node:crypto";
import { logger } from "@formbricks/logger";
import type { TChartQuery } from "@formbricks/types/analysis";
import { AUDIT_LOG_ENABLED } from "@/lib/constants";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { getOrganization } from "@/lib/organization/service";
import { withResponseBaseMeasure } from "@/modules/ee/analysis/charts/lib/response-base";
import { expandPresetDateRanges } from "@/modules/ee/analysis/lib/date-presets";
import {
  type TCubeEmbeddedField,
  isEmbeddedFieldMember,
  toCubeEmbeddedFields,
} from "@/modules/ee/analysis/lib/embedded-data-fields";
import { getEmbeddedChartFields } from "@/modules/ee/analysis/lib/embedded-data-fields.server";
import { isRatioMeasure } from "@/modules/ee/analysis/lib/schema-definition";
import {
  MAX_TIME_BUCKETS,
  countTimeBuckets,
  countTimeBucketsSpanning,
  isTimeBucketGranularity,
} from "@/modules/ee/analysis/lib/time-buckets";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import {
  UNKNOWN_AUDIT_REQUEST_METADATA,
  getAuditRequestMetadata,
} from "@/modules/ee/audit-logs/lib/request-metadata";
import type { TAuditRequestMetadata } from "@/modules/ee/audit-logs/types/request-metadata";
import { type TCubeQueryActor, type TCubeQuerySource, getCubeApiConfig } from "./cube-config";
import {
  applyValueBandNullGuard,
  getCubeQueryAuditSummary,
  getCubeQueryMembers,
  validateCubeQueryMembers,
} from "./cube-query";

const CUBE_QUERY_ERROR_MESSAGE =
  "Cube query failed. Verify CUBEJS_API_URL and CUBEJS_API_SECRET, and ensure the Cube service is running.";

/**
 * The longest one chart query may hold a request open, across every round trip it makes. Cube answers a
 * slow query with "Continue wait" and the client polls again, so a per-fetch timeout would never fire on
 * a query that keeps Cube busy; one signal shared by the whole load is a deadline for the query.
 *
 * A minute leaves room for a cold, unaggregated query on a large directory, while an agent looping on an
 * expensive query can no longer hold requests open indefinitely (ENG-6582).
 */
export const CUBE_QUERY_TIMEOUT_MS = 60_000;

/**
 * Any failure of a chart query that is not the caller's own input: Cube unreachable, rejected, or out of
 * time. Callers see a generic message — Cube's own error can name members, SQL or infrastructure — and
 * `timedOut` lets them say which of the two it was without exposing anything more.
 */
export class CubeQueryError extends Error {
  readonly timedOut: boolean;

  constructor(timedOut: boolean) {
    super(CUBE_QUERY_ERROR_MESSAGE);
    this.name = "CubeQueryError";
    this.timedOut = timedOut;
  }
}

type TScopedCubeQueryInput = {
  query: TChartQuery;
  feedbackDirectoryId: string;
  workspaceId: string;
  organizationId: string;
  actor: TCubeQueryActor;
  source: TCubeQuerySource;
};

const queueCubeQueryAuditEvent = ({
  error,
  input,
  requestId,
  requestMetadata,
  status,
}: {
  error?: unknown;
  input: TScopedCubeQueryInput;
  requestId: string;
  requestMetadata: TAuditRequestMetadata;
  status: "success" | "failure";
}) => {
  const errorName = error instanceof Error ? error.name : undefined;

  void queueAuditEventWithoutRequest({
    action: "queried",
    targetType: "cubeQuery",
    userId: input.actor.id,
    userType: input.actor.type === "user" ? "user" : "api",
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
      actor: input.actor,
      source: input.source,
      query: getCubeQueryAuditSummary(input.query),
      ...(errorName ? { errorName } : {}),
    },
    requestMetadata,
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

/**
 * How many date buckets `tablePivot` would invent rows for. The client fills the first time dimension
 * when it has a granularity, over the date range Cube echoes back — or, without one, over the span of
 * the rows — and it builds every bucket synchronously, whatever the data holds. Counting first keeps
 * one query from allocating millions of rows in this process (ENG-6603).
 */
const countFilledTimeBuckets = (resultSet: ResultSet): number => {
  const timeDimension = resultSet.query().timeDimensions?.[0];
  const granularity = timeDimension?.granularity;
  if (!timeDimension || !granularity) return 0;
  // A custom granularity cannot be counted here, so its buckets are never filled.
  if (!isTimeBucketGranularity(granularity)) return Number.POSITIVE_INFINITY;

  const { dateRange } = timeDimension;
  if (Array.isArray(dateRange) && dateRange.length === 2) {
    return countTimeBuckets(dateRange[0], dateRange[1], granularity);
  }

  const bucketKey = `${timeDimension.dimension}.${granularity}`;
  const rows = resultSet.rawData() as Record<string, unknown>[];
  return countTimeBucketsSpanning(
    rows.map((row) => row[bucketKey]),
    granularity
  );
};

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

/**
 * Thrown when a query names an Embedded Data field the dataset no longer declares — the field was
 * renamed, or removed from every survey behind the dataset. A caller error, like an unknown member.
 */
export class UnknownEmbeddedFieldError extends Error {
  constructor() {
    super("The chart uses an Embedded Data field this dataset no longer has.");
    this.name = "UnknownEmbeddedFieldError";
  }
}

/**
 * The dataset's Embedded Data fields for Cube's token, or `undefined` when the query uses none — so
 * every other chart keeps the fixed schema and costs no lookup (ENG-2848).
 */
const resolveQueryEmbeddedFields = async (
  input: TScopedCubeQueryInput
): Promise<TCubeEmbeddedField[] | undefined> => {
  const used = getCubeQueryMembers(input.query).filter(isEmbeddedFieldMember);
  if (used.length === 0) return undefined;

  const fields = await getEmbeddedChartFields(input.workspaceId, input.feedbackDirectoryId);
  const known = new Set(fields.map((field) => field.id));
  if (used.some((member) => !known.has(member))) throw new UnknownEmbeddedFieldError();

  return toCubeEmbeddedFields(fields);
};

export async function executeTenantScopedQuery(input: TScopedCubeQueryInput) {
  // Read before Cube/network work so every outcome retains the request that initiated the query.
  const requestMetadata = AUDIT_LOG_ENABLED
    ? await getAuditRequestMetadata()
    : UNKNOWN_AUDIT_REQUEST_METADATA;
  try {
    validateCubeQueryMembers(input.query);
  } catch (error) {
    queueCubeQueryAuditEvent({ error, input, requestMetadata, requestId: randomUUID(), status: "failure" });
    logger.warn(error, "Cube query validation failed");
    throw error;
  }

  let embeddedFields: TCubeEmbeddedField[] | undefined;
  try {
    embeddedFields = await resolveQueryEmbeddedFields(input);
  } catch (error) {
    queueCubeQueryAuditEvent({ error, input, requestMetadata, requestId: randomUUID(), status: "failure" });
    logger.warn(error, "Cube query validation failed");
    throw error;
  }

  const tenantScope = {
    feedbackDirectoryId: input.feedbackDirectoryId,
    workspaceId: input.workspaceId,
    organizationId: input.organizationId,
    actor: input.actor,
    source: input.source,
    embeddedFields,
  };
  let apiUrl: string;
  let requestId: string;
  let token: string;

  try {
    ({ apiUrl, requestId, token } = getCubeApiConfig(tenantScope));
  } catch (error) {
    queueCubeQueryAuditEvent({ error, input, requestMetadata, requestId: randomUUID(), status: "failure" });
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
    queueCubeQueryAuditEvent({ error, input, requestMetadata, requestId, status: "failure" });
    logger.error(error, "Cube query time zone lookup failed");
    throw error;
  }

  const deadline = AbortSignal.timeout(CUBE_QUERY_TIMEOUT_MS);
  try {
    const client = cubejs(token, { apiUrl, signal: deadline });
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
    // Past the cap the chart gets its real rows only, with gaps where buckets are empty, rather than
    // a row for every bucket in the range.
    const fillMissingDates = countFilledTimeBuckets(resultSet) <= MAX_TIME_BUCKETS;
    if (!fillMissingDates) {
      logger.warn(
        { source: input.source, maxTimeBuckets: MAX_TIME_BUCKETS },
        "Chart query spans more time buckets than the cap; empty buckets are not filled"
      );
    }
    const filled = resultSet.tablePivot(
      fillMissingDates
        ? { fillWithValue: NULL_FILL_SENTINEL }
        : { fillMissingDates: false, fillWithValue: NULL_FILL_SENTINEL }
    );

    // The pivot only invents rows for empty buckets when there is exactly one granular time
    // dimension (see NULL_FILL_SENTINEL); with none, or several, every row it returns is real.
    let result: TChartDataRow[];
    if (fillMissingDates && granular.length === 1) {
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
    queueCubeQueryAuditEvent({ input, requestMetadata, requestId, status: "success" });
    return result;
  } catch (error) {
    const timedOut = deadline.aborted;
    queueCubeQueryAuditEvent({ error, input, requestMetadata, requestId, status: "failure" });
    logger.error({ err: error, timedOut, source: input.source }, "Cube query failed");

    throw new CubeQueryError(timedOut);
  }
}
