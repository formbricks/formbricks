import {
  TBaseFilters,
  TSegmentConnector,
  TSegmentSurveyInteractionFilter,
  TSegmentSurveyInteractionFilterValue,
  TSurveyInteractionOperator,
} from "@formbricks/types/segment";
import { isResourceFilter } from "@/modules/ee/contacts/segments/lib/utils";
import { subtractTimeUnit } from "../date-utils";

/**
 * Survey-interaction targeting is evaluated two ways that MUST stay in lockstep:
 *  - in memory, against a contact's already-loaded displays/responses (the contact-sync hot path), and
 *  - as a Prisma `where` clause, against the whole workspace (the dashboard segment preview).
 *
 * This module is the single source of truth for the operator semantics and the time window so the two
 * paths can never drift. The Prisma builder (see `prisma-query.ts`) consumes {@link SURVEY_INTERACTION_SEMANTICS}
 * and {@link getSurveyInteractionWindowStart}; the in-memory path additionally uses the evaluators below.
 */

/** The minimal display row shape needed to evaluate a "seen" interaction in memory. */
export interface TContactDisplayRow {
  surveyId: string;
  createdAt: Date;
}

/** The minimal response row shape needed to evaluate "started"/"completed" interactions in memory. */
export interface TContactResponseRow {
  surveyId: string;
  createdAt: Date;
  finished: boolean;
}

/**
 * A contact's interaction history. For the in-memory path to match the Prisma path exactly this MUST be
 * complete for the widest filter window in play — i.e. loaded without a `take` limit (see
 * `getContactWithFullData`). Truncating either relation would silently diverge the two evaluators.
 */
export interface TContactInteractionData {
  displays: TContactDisplayRow[];
  responses: TContactResponseRow[];
}

/** How a single operator resolves to a presence check over the contact's interaction relations. */
interface TSurveyInteractionSemantics {
  /** Which relation the interaction lives on. */
  source: "displays" | "responses";
  /** Whether only completed (`finished`) responses count. Never set for display sources. */
  requireFinished: boolean;
  /** Whether the operator asserts the ABSENCE of a matching interaction ("have not …"). */
  negate: boolean;
}

export const SURVEY_INTERACTION_SEMANTICS: Record<TSurveyInteractionOperator, TSurveyInteractionSemantics> = {
  haveSeen: { source: "displays", requireFinished: false, negate: false },
  haveNotSeen: { source: "displays", requireFinished: false, negate: true },
  haveStartedRespondingTo: { source: "responses", requireFinished: false, negate: false },
  haveCompleted: { source: "responses", requireFinished: true, negate: false },
  haveNotCompleted: { source: "responses", requireFinished: true, negate: true },
};

/**
 * Start of the interaction window: an interaction counts when its `createdAt` is at or after this
 * instant. Centralized so the in-memory and Prisma paths compute an identical boundary.
 */
export const getSurveyInteractionWindowStart = (
  value: TSegmentSurveyInteractionFilterValue,
  now: Date
): Date => subtractTimeUnit(now, value.within.amount, value.within.unit);

const isSurveyInScope = (surveyId: string, value: TSegmentSurveyInteractionFilterValue): boolean =>
  value.surveyScope === "any" || value.surveyIds.includes(surveyId);

/**
 * Evaluates a single survey-interaction filter in memory. Mirrors
 * `buildSurveyInteractionFilterWhereClause`: the same window boundary (`createdAt >= windowStart`),
 * survey-scope test, and `finished` requirement, with the negative operators inverting the presence
 * check — exactly as the Prisma path wraps its clause in `NOT`.
 */
export const evaluateSurveyInteractionFilterInMemory = (
  filter: TSegmentSurveyInteractionFilter,
  data: TContactInteractionData,
  now: Date
): boolean => {
  const { value } = filter;
  const semantics = SURVEY_INTERACTION_SEMANTICS[filter.qualifier.operator];
  const windowStart = getSurveyInteractionWindowStart(value, now);

  const hasMatch =
    semantics.source === "displays"
      ? data.displays.some(
          (display) => display.createdAt >= windowStart && isSurveyInScope(display.surveyId, value)
        )
      : data.responses.some(
          (response) =>
            response.createdAt >= windowStart &&
            isSurveyInScope(response.surveyId, value) &&
            (!semantics.requireFinished || response.finished)
        );

  return semantics.negate ? !hasMatch : hasMatch;
};

interface TFilterResultPair {
  result: boolean;
  connector: TSegmentConnector;
}

/**
 * Combines per-filter boolean results using their connectors with AND-before-OR precedence:
 * consecutive `and` connectors form a group, `or` starts a new group, and the segment matches if any
 * group matches. The first pair's connector is always `null` (start of a group) and is ignored.
 */
export const combineFilterResults = (pairs: TFilterResultPair[]): boolean => {
  if (pairs.length === 0) {
    return false;
  }

  const orGroupResults: boolean[] = [];
  let currentAndGroupResult = pairs[0].result;

  for (let i = 1; i < pairs.length; i++) {
    const { result, connector } = pairs[i];
    if (connector === "or") {
      orGroupResults.push(currentAndGroupResult);
      currentAndGroupResult = result;
    } else {
      // "and" (or a defensive null) folds into the current AND group
      currentAndGroupResult = currentAndGroupResult && result;
    }
  }
  orGroupResults.push(currentAndGroupResult);

  return orGroupResults.some(Boolean);
};

/**
 * Attempts to evaluate an entire segment filter tree in memory using only the contact's already-loaded
 * interaction data — the case that needs no database round trip.
 *
 * Returns the membership boolean when EVERY leaf is a survey-interaction filter, or `null` when any leaf
 * requires data not present in memory (attribute / device / person / nested-segment reference), signaling
 * the caller to fall back to the Prisma path. All-or-nothing by design: a segment can only skip the DB
 * when it is fully answerable from the loaded interaction data.
 */
export const tryEvaluateSurveyInteractionSegmentInMemory = (
  filters: TBaseFilters,
  data: TContactInteractionData,
  now: Date
): boolean | null => {
  // An empty group is not an interaction-only segment; let the caller apply its always-match semantics.
  if (filters.length === 0) {
    return null;
  }

  const resultPairs: TFilterResultPair[] = [];

  for (const { resource, connector } of filters) {
    let result: boolean;

    if (Array.isArray(resource)) {
      // Nested group: only in-memory-evaluable if every descendant is too.
      const nestedResult = tryEvaluateSurveyInteractionSegmentInMemory(resource, data, now);
      if (nestedResult === null) {
        return null;
      }
      result = nestedResult;
    } else if (resource && isResourceFilter(resource) && resource.root.type === "surveyInteraction") {
      result = evaluateSurveyInteractionFilterInMemory(
        resource as TSegmentSurveyInteractionFilter,
        data,
        now
      );
    } else {
      // A non-interaction leaf (attribute / device / person / segment) or a malformed node — this
      // segment needs the database path.
      return null;
    }

    resultPairs.push({ result, connector });
  }

  return combineFilterResults(resultPairs);
};
