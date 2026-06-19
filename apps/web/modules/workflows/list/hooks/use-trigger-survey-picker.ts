"use client";

import { useQuery } from "@tanstack/react-query";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import { initialFilters } from "@/modules/survey/list/lib/constants";
import { listSurveys } from "@/modules/survey/list/lib/v3-surveys-client";

// Trigger picker needs every survey in the workspace, not just the first page. Walk the v3
// cursor-paginated list until exhausted. A typeahead-driven endpoint would scale better for
// huge workspaces — track that as a follow-up.
const SURVEY_LIST_PAGE_SIZE = 100;

interface TWorkflowSurveyOption {
  id: string;
  name: string;
}

interface TWorkflowSurveyEnding {
  id: string;
  label: string;
}

// The v3 survey endpoint serializes i18n strings into a language-keyed map
// (e.g. `headline = { "en-US": "Thanks!" }`), so the canonical `ZSurveyEndings` shape
// (`headline.default`) doesn't apply. Read the survey's `defaultLanguage` from the response
// and look up the headline value under that key, falling back to any other string value if
// the default slot is missing. HTML is stripped so the trigger dropdown renders plain text.
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
    queryFn: async ({ signal }) => {
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
      if (!isEndingArray(body.data.endings)) return [];
      const endings: TWorkflowSurveyEnding[] = body.data.endings
        .filter((raw): raw is RawEnding & { id: string } => typeof raw.id === "string" && raw.id.length > 0)
        .map((raw) => ({ id: raw.id, label: endingDisplayLabel(raw, defaultLanguage) }));
      return endings;
    },
  });
  return { ...query, endings: query.data ?? [] };
};
