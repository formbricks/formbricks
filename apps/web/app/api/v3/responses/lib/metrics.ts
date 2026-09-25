import "server-only";
import { type Attributes, type Counter, type Histogram, metrics } from "@opentelemetry/api";
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
      reads: meter.createCounter("formbricks.api.v3.responses.reads", {
        description: "v3 response reads by operation, surface, status class and the filter keys used",
        unit: "{request}",
      }),
      duration: meter.createHistogram("formbricks.api.v3.responses.read.duration", {
        description: "Wall-clock duration of one v3 response read, parse to response",
        unit: "ms",
      }),
      pageSurveys: meter.createHistogram("formbricks.api.v3.responses.page.surveys", {
        advice: { explicitBucketBoundaries: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 250] },
        description: "Distinct surveys one v3 list page spans — the size of its single survey query",
        unit: "{survey}",
      }),
      unresolvedEntries: meter.createCounter("formbricks.api.v3.responses.unresolved.entries", {
        description: "unresolved[] entries served by v3 response reads, by reason",
        unit: "{entry}",
      }),
      unresolvedResponses: meter.createCounter("formbricks.api.v3.responses.unresolved.responses", {
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
    duration.record(Math.max(0, sample.durationMs), base);

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

export interface TV3ResponsesReadTimer {
  /** Mutable, filled in by the operation as it learns what the read was. */
  observation: TV3ResponsesReadObservation;
  /** Record the read against the response about to be returned, and hand it back unchanged. */
  done: (response: Response) => Response;
}

/**
 * Start timing one read. Every exit of the operation returns through `done`, so a 400, a 403 and a
 * 200 all land in the same counter with their own status class.
 */
export const startV3ResponsesRead = (params: {
  operation: TV3ResponsesReadOperation;
  authentication: TV3Authentication;
  instance?: string;
}): TV3ResponsesReadTimer => {
  const startedAt = performance.now();
  const via = resolveV3RequestVia(params.authentication, params.instance ?? "");
  const observation: TV3ResponsesReadObservation = {};

  return {
    observation,
    done: (response) => {
      recordV3ResponsesRead({
        ...observation,
        operation: params.operation,
        via,
        status: response.status,
        durationMs: performance.now() - startedAt,
      });
      return response;
    },
  };
};
