import "server-only";
import { type Attributes, type Counter, type Histogram, metrics } from "@opentelemetry/api";
import type { NextRequest } from "next/server";
import { AsyncLocalStorage } from "node:async_hooks";
import { type TV3RequestVia, resolveV3RequestVia } from "@/app/api/v3/lib/request-via";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import type { TV3ResponsesFilter } from "./parse-v3-responses-list-query";
import type { TV3ResponseUnresolvedEntry } from "./resources";

/**
 * Read-path telemetry for the v3 responses API (ENG-2898), as OpenTelemetry metrics.
 *
 * Metrics rather than product events, deliberately: a list or count is issued per page by agents
 * walking a cursor and by integrations polling, so it runs at request volume — the one shape
 * `survey_response_received` had to be milestone-sampled to survive in PostHog. Counters and
 * histograms absorb that natively, and every attribute below is bounded so the series count stays
 * small.
 *
 * **Field names, counts and timestamps only.** Nothing here reads `data`, an answer value, a filter
 * value, or a contact field. The filter attribute is the set of filter *keys* a caller used; the
 * unresolved attribute is the contract's `reason` enum, never the orphaned key itself, which would be
 * both unbounded and, for a hidden field, caller-named.
 *
 * ## Two entry points, one record per read
 *
 * A read reaches the operation two ways. Over HTTP it passes through `withV3ApiWrapper`, which can
 * answer 401, 429 or 400 before the operation ever runs; the MCP tools call the operation directly
 * with no wrapper at all. So the timer has to live at *both* boundaries without counting a request
 * twice: `withV3ResponsesReadMetrics` opens a request-scoped context around the route, the operation's
 * `startV3ResponsesRead` joins that context when one exists and fills in what it learned, and only
 * the outer boundary records. With no context — the MCP path — the operation records itself.
 *
 * ## Names
 *
 * Spelled out Prometheus-style (`_total`, `_seconds`) rather than dotted, following the AuthZed
 * metrics: the direct Prometheus exporter and an OTLP-to-Prometheus translation each rewrite a dotted
 * name differently, so a dotted instrument is two series names across the two supported readers. The
 * names below are the exported names, byte for byte, and the monitoring guide lists them.
 *
 * `metrics.getMeter()` hands back a proxy that binds to the SDK's provider once
 * `instrumentation-node.ts` has registered it and stays a no-op otherwise, so recording is safe with
 * metrics export disabled.
 */

export type TV3ResponsesReadOperation = "list" | "count" | "get";

/** What one read learned about itself on the way through, filled in by the operation as it goes. */
export interface TV3ResponsesReadObservation {
  /** The parsed filter, once the query was accepted. Absent on a 400. */
  filter?: TV3ResponsesFilter;
  /** List only: whether the caller continued from a cursor rather than starting a walk. */
  cursorUsed?: boolean;
  /** List only: whether `meta.totalCount` was requested, which costs a second query. */
  includeTotalCount?: boolean;
  /** Count only: the documented slow path is `exact`. */
  precision?: string;
  /** List only: how many distinct surveys the page spans, i.e. the size of the one survey query. */
  pageSurveyCount?: number;
  /** The serialized items, read for their `unresolved[]` and nothing else. */
  items?: readonly Pick<{ unresolved: readonly TV3ResponseUnresolvedEntry[] }, "unresolved">[];
}

export interface TV3ResponsesReadSample extends TV3ResponsesReadObservation {
  operation: TV3ResponsesReadOperation;
  via: TV3RequestVia;
  status: number;
  durationMs: number;
}

const METER_NAME = "formbricks.api.v3.responses";

export const V3_RESPONSES_READS_TOTAL = "formbricks_api_v3_responses_reads_total";
export const V3_RESPONSES_READ_DURATION_SECONDS = "formbricks_api_v3_responses_read_duration_seconds";
export const V3_RESPONSES_PAGE_SURVEYS = "formbricks_api_v3_responses_page_surveys";
export const V3_RESPONSES_UNRESOLVED_ENTRIES_TOTAL = "formbricks_api_v3_responses_unresolved_entries_total";
export const V3_RESPONSES_UNRESOLVED_RESPONSES_TOTAL =
  "formbricks_api_v3_responses_unresolved_responses_total";

interface TInstruments {
  reads: Counter;
  duration: Histogram;
  pageSurveys: Histogram;
  unresolvedEntries: Counter;
  unresolvedResponses: Counter;
}

let instruments: TInstruments | undefined;

const getInstruments = (): TInstruments => {
  if (!instruments) {
    const meter = metrics.getMeter(METER_NAME);
    instruments = {
      reads: meter.createCounter(V3_RESPONSES_READS_TOTAL, {
        description: "v3 response reads by operation, surface, status class and the filter keys used",
        unit: "{request}",
      }),
      duration: meter.createHistogram(V3_RESPONSES_READ_DURATION_SECONDS, {
        advice: {
          explicitBucketBoundaries: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        },
        description: "Wall-clock duration of one v3 response read, request boundary to response",
        unit: "s",
      }),
      pageSurveys: meter.createHistogram(V3_RESPONSES_PAGE_SURVEYS, {
        // 0.5 first, not 1: OpenTelemetry buckets are upper-inclusive, so boundaries starting at 1 put
        // an empty page (0) and the common one-survey page (1) in the same `le="1"` bucket. The same
        // integer-count pattern as the authorization checks-per-request histogram.
        advice: { explicitBucketBoundaries: [0.5, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 250] },
        description: "Distinct surveys one v3 list page spans — the size of its single survey query",
        unit: "{survey}",
      }),
      unresolvedEntries: meter.createCounter(V3_RESPONSES_UNRESOLVED_ENTRIES_TOTAL, {
        description: "unresolved[] entries served by v3 response reads, by reason",
        unit: "{entry}",
      }),
      unresolvedResponses: meter.createCounter(V3_RESPONSES_UNRESOLVED_RESPONSES_TOTAL, {
        description: "Responses served by v3 reads with at least one unresolved[] entry",
        unit: "{response}",
      }),
    };
  }
  return instruments;
};

/**
 * The filter keys a caller used, as one sorted attribute value.
 *
 * `workspaceId` is left out because it is always present — it is the scope, not a filter. The nine
 * remaining keys give at most 512 combinations, and in practice a handful, so this stays a bounded
 * attribute rather than a per-caller series. Keys, never values: nothing a respondent or a caller
 * wrote reaches the metric.
 */
export const toFilterKeysAttribute = (filter: TV3ResponsesFilter | undefined): string => {
  if (!filter) return "none";

  const keys = Object.entries(filter)
    .filter(([key, value]) => key !== "workspaceId" && value !== undefined)
    .map(([key]) => key)
    .sort((a, b) => a.localeCompare(b));

  return keys.length > 0 ? keys.join(",") : "none";
};

export const toStatusClass = (status: number): string => `${Math.floor(status / 100)}xx`;

export interface TV3UnresolvedTally {
  /** Responses carrying at least one entry. */
  responses: number;
  /** Entries by their contract `reason`. */
  entries: Record<string, number>;
}

/** Count `unresolved[]` across a page, by reason — the data-integrity canary of ENG-2898 §2. */
export const tallyUnresolved = (
  items: readonly Pick<{ unresolved: readonly TV3ResponseUnresolvedEntry[] }, "unresolved">[]
): TV3UnresolvedTally => {
  const tally: TV3UnresolvedTally = { responses: 0, entries: {} };

  for (const item of items) {
    if (item.unresolved.length === 0) continue;
    tally.responses += 1;
    for (const entry of item.unresolved) {
      tally.entries[entry.reason] = (tally.entries[entry.reason] ?? 0) + 1;
    }
  }

  return tally;
};

export const recordV3ResponsesRead = (sample: TV3ResponsesReadSample): void => {
  try {
    const { reads, duration, pageSurveys, unresolvedEntries, unresolvedResponses } = getInstruments();
    const base: Attributes = {
      operation: sample.operation,
      via: sample.via,
      status_class: toStatusClass(sample.status),
    };

    const readAttributes: Attributes = { ...base, filters: toFilterKeysAttribute(sample.filter) };
    if (sample.cursorUsed !== undefined) readAttributes.cursor = sample.cursorUsed;
    if (sample.includeTotalCount !== undefined) readAttributes.include_total_count = sample.includeTotalCount;
    if (sample.precision !== undefined) readAttributes.precision = sample.precision;

    reads.add(1, readAttributes);
    duration.record(Math.max(0, sample.durationMs) / 1_000, base);

    if (sample.pageSurveyCount !== undefined) {
      pageSurveys.record(sample.pageSurveyCount, { via: sample.via });
    }

    if (sample.items) {
      const tally = tallyUnresolved(sample.items);
      if (tally.responses > 0) {
        unresolvedResponses.add(tally.responses, { operation: sample.operation });
      }
      for (const [reason, count] of Object.entries(tally.entries)) {
        unresolvedEntries.add(count, { operation: sample.operation, reason });
      }
    }
  } catch {
    // Telemetry must never turn into a failed read: the response is already built by the time this
    // runs, and an instrumentation fault has no business changing it.
  }
};

/** One read in flight, from whichever boundary opened it. */
interface TV3ResponsesReadContext {
  operation: TV3ResponsesReadOperation;
  via: TV3RequestVia;
  startedAt: number;
  observation: TV3ResponsesReadObservation;
}

const readContext = new AsyncLocalStorage<TV3ResponsesReadContext>();

const finish = (context: TV3ResponsesReadContext, status: number): void => {
  recordV3ResponsesRead({
    ...context.observation,
    operation: context.operation,
    via: context.via,
    status,
    durationMs: performance.now() - context.startedAt,
  });
};

/**
 * The surface a request *presents* as, before anything has authenticated it: the same test the
 * wrapper uses to choose the API-key path. Provisional — the operation replaces it with the
 * authenticated answer once it runs — but it is what a 401 or 429 gets attributed to.
 */
const presentedVia = (headers: Headers): TV3RequestVia => {
  if (headers.get("x-api-key")?.trim()) return "api";
  return headers.get("authorization")?.trim().toLowerCase().startsWith("bearer ") ? "api" : "ui";
};

/**
 * Wrap a response-route handler so *every* exit is recorded, including the ones `withV3ApiWrapper`
 * takes before the operation runs: an unauthenticated 401, a rate-limited 429, a 400 from the route's
 * own schemas. Without this the `status_class` breakdown undercounts 4xx and the counter measures the
 * operation rather than the endpoint.
 *
 * The operation still fills in the filter keys, page spread and items through the shared context —
 * this records once, at the end, with everything both layers learned.
 */
export const withV3ResponsesReadMetrics =
  <TProps>(
    operation: TV3ResponsesReadOperation,
    route: (req: NextRequest, props: TProps) => Promise<Response>
  ): ((req: NextRequest, props: TProps) => Promise<Response>) =>
  async (req, props) => {
    const context: TV3ResponsesReadContext = {
      operation,
      via: presentedVia(req.headers),
      startedAt: performance.now(),
      observation: {},
    };

    return readContext.run(context, async () => {
      try {
        const response = await route(req, props);
        finish(context, response.status);
        return response;
      } catch (error) {
        // The wrapper maps every throw to a problem response, so this is unreachable in practice —
        // but a read that did escape is still a read, and a 5xx is the only honest class for it.
        finish(context, 500);
        throw error;
      }
    });
  };

export interface TV3ResponsesReadTimer {
  /** Mutable, filled in by the operation as it learns what the read was. */
  observation: TV3ResponsesReadObservation;
  /** Record the read against the response about to be returned, and hand it back unchanged. */
  done: (response: Response) => Response;
}

/**
 * Start timing one read from inside the operation. Every exit of the operation returns through
 * `done`, so a 400, a 403 and a 200 all land in the same counter with their own status class.
 *
 * Inside a `withV3ResponsesReadMetrics` boundary this joins the request's context instead of opening
 * one: the observation is shared, the authenticated `via` replaces the presented one, and `done` is a
 * pass-through, so the read is recorded exactly once, by the boundary. Outside one — the MCP tools
 * call the operations directly — it records itself.
 */
export const startV3ResponsesRead = (params: {
  operation: TV3ResponsesReadOperation;
  authentication: TV3Authentication;
  instance?: string;
}): TV3ResponsesReadTimer => {
  const via = resolveV3RequestVia(params.authentication, params.instance ?? "");
  const outer = readContext.getStore();

  if (outer && outer.operation === params.operation) {
    outer.via = via;
    return { observation: outer.observation, done: (response) => response };
  }

  const context: TV3ResponsesReadContext = {
    operation: params.operation,
    via,
    startedAt: performance.now(),
    observation: {},
  };

  return {
    observation: context.observation,
    done: (response) => {
      finish(context, response.status);
      return response;
    },
  };
};
