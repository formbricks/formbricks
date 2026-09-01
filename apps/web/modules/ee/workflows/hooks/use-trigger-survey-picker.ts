"use client";

import { useQuery } from "@tanstack/react-query";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import { initialFilters } from "@/modules/survey/list/lib/constants";
import { listSurveys } from "@/modules/survey/list/lib/v3-surveys-client";

// Picker needs every survey, so walk the v3 cursor list until exhausted.
const SURVEY_LIST_PAGE_SIZE = 100;
// Ceiling so a runaway cursor can't spin forever; covers 2,000 surveys, then the picker truncates.
const SURVEY_LIST_MAX_PAGES = 20;

interface TWorkflowSurveyOption {
  id: string;
  name: string;
}

interface TWorkflowSurveyEnding {
  id: string;
  label: string;
}

// The v3 survey endpoint serializes i18n strings as a language-keyed map (e.g.
// `headline = { "en-US": "Thanks!" }`), not the canonical `headline.default` shape — so read the
// value under the survey's `defaultLanguage` (falling back to any string), stripped to plain text.
interface RawEnding {
  id?: string;
  type?: unknown;
  headline?: Record<string, unknown>;
  label?: unknown;
}

const pickDefaultLanguageString = (value: unknown, defaultLanguage: string): string | null => {
  if (!value || typeof value !== "object") return null;
  const map = value as Record<string, unknown>;
  const direct = map[defaultLanguage];
  if (typeof direct === "string" && direct.trim()) return direct;
  for (const entry of Object.values(map)) {
    if (typeof entry === "string" && entry.trim()) return entry;
  }
  return null;
};

const endingDisplayLabel = (raw: RawEnding, defaultLanguage: string): string => {
  const id = typeof raw.id === "string" ? raw.id : "";
  if (raw.type === "endScreen") {
    const headlineText = pickDefaultLanguageString(raw.headline, defaultLanguage);
    if (headlineText) {
      const stripped = getTextContent(headlineText);
      if (stripped) return stripped;
    }
  } else if (raw.type === "redirectToUrl") {
    const label = typeof raw.label === "string" ? raw.label.trim() : "";
    if (label) return label;
  }
  return id;
};

const isEndingArray = (value: unknown): value is RawEnding[] =>
  Array.isArray(value) && value.every((entry) => entry && typeof entry === "object");

export const useWorkflowSurveyOptions = (workspaceId: string) => {
  const query = useQuery({
    queryKey: ["workflow-trigger", "surveys", workspaceId],
    queryFn: async ({ signal }) => {
      const options: TWorkflowSurveyOption[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const page = await listSurveys({
          workspaceId,
          limit: SURVEY_LIST_PAGE_SIZE,
          cursor,
          filters: initialFilters,
          signal,
        });
        for (const survey of page.data) {
          options.push({ id: survey.id, name: survey.name });
        }
        cursor = page.meta.nextCursor;
        pages += 1;
        if (pages >= SURVEY_LIST_MAX_PAGES && cursor) {
          console.warn(
            `Workflow trigger survey picker truncated at ${SURVEY_LIST_MAX_PAGES * SURVEY_LIST_PAGE_SIZE} surveys.`
          );
          break;
        }
      } while (cursor);
      return options;
    },
  });
  return { ...query, options: query.data ?? [] };
};

export const useWorkflowSurveyEndings = (surveyId: string | null | undefined) => {
  const query = useQuery({
    queryKey: ["workflow-trigger", "survey-endings", surveyId],
    enabled: Boolean(surveyId),
    queryFn: async ({ signal }): Promise<{ surveyId: string | null; endings: TWorkflowSurveyEnding[] }> => {
      // Unreachable (`enabled` gates on a truthy id); keeps the resolved id non-optional for callers.
      if (!surveyId) return { surveyId: null, endings: [] };

      const response = await fetch(`/api/v3/surveys/${surveyId}`, {
        method: "GET",
        cache: "no-store",
        signal,
      });
      if (!response.ok) {
        throw await parseV3ApiError(response);
      }
      const body = (await response.json()) as {
        data: { defaultLanguage?: unknown; endings: unknown };
      };
      const defaultLanguage =
        typeof body.data.defaultLanguage === "string" && body.data.defaultLanguage.length > 0
          ? body.data.defaultLanguage
          : "default";
      // Throw on a malformed shape rather than returning an empty list: a "successful" empty result
      // is indistinguishable from "all endings deleted" and would trigger a destructive auto-prune.
      if (!isEndingArray(body.data.endings)) {
        throw new Error(`Unexpected survey endings response shape for survey ${surveyId}`);
      }
      const endings: TWorkflowSurveyEnding[] = body.data.endings
        .filter((raw): raw is RawEnding & { id: string } => typeof raw.id === "string" && raw.id.length > 0)
        .map((raw) => ({ id: raw.id, label: endingDisplayLabel(raw, defaultLanguage) }));
      return { surveyId, endings };
    },
  });
  return {
    ...query,
    endings: query.data?.endings ?? [],
    // The survey the cached endings belong to. Callers pruning stored ids must check it — reading a
    // previous survey's (or unsettled) response as the current one would delete a valid selection.
    resolvedSurveyId: query.data?.surveyId ?? null,
  };
};
