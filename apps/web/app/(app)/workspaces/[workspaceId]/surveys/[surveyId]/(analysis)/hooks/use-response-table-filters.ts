"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { useOrganization } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import type {
  DateRange,
  FilterValue,
  SelectedFilterValue,
} from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import { getSurveyFilterDataAction } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/actions";
import { generateElementAndFilterOptions, getFormattedFilters } from "@/app/lib/surveys/surveys";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { useTableUrlState } from "@/modules/ui/components/table-toolbar/hooks/use-table-url-state";
import { STRING_RULE_OPERATORS } from "@/modules/ui/components/table-toolbar/lib/operators";
import type { TFilterProperty, TTableFilter } from "@/modules/ui/components/table-toolbar/lib/types";
import {
  buildResponseFilterModel,
  filterValueToTableFilter,
  isQuestionFilter,
  normalizeSummaryFilterRow,
  toResponseFilterState,
} from "../lib/response-table-filters";

const FILTER_KEY_PATTERN = /^filter\[([^\]]+)\]\[[^\]]+\]$/;

/**
 * Attribute keys and quotas are known only once the filter data has loaded. Until then a rule on one
 * in the URL stands in as a plain property, so a write made meanwhile (ticking a status) keeps it.
 */
const pendingProperties = (known: readonly TFilterProperty[], search: string): TFilterProperty[] => {
  const knownIds = new Set(known.map((property) => property.id));
  const pending = new Set<string>();
  for (const key of new URLSearchParams(search).keys()) {
    const id = FILTER_KEY_PATTERN.exec(key)?.[1];
    if (id && !knownIds.has(id) && (id.startsWith("attribute.") || id.startsWith("quota."))) pending.add(id);
  }
  return [...pending].map((id) => ({
    id,
    label: id.slice(id.indexOf(".") + 1),
    valueType: "string",
    ruleOperators: [...STRING_RULE_OPERATORS],
  }));
};

const surveyFilterDataKey = (surveyId: string) => ["surveys", surveyId, "filter-data"] as const;

/**
 * The Responses / Summary filter, kept in the page URL so it follows a tab switch, a reload and a shared
 * link (ADR 0003). It hands the pages the same `selectedFilter` / `dateRange` the response pipeline
 * always read, with an identity that only changes when the filter does: every server action refreshes
 * the route, and a filter that changed identity on each refresh would refetch forever.
 */
export const useResponseTableFilters = (survey: TSurvey) => {
  const { t } = useTranslation();
  const { organization } = useOrganization();
  const timeZone = getReportingTimeZone(organization?.displayTimeZone);

  const filterData = useQuery({
    queryKey: surveyFilterDataKey(survey.id),
    queryFn: async () => (await getSurveyFilterDataAction({ surveyId: survey.id }))?.data ?? null,
    staleTime: 60_000,
  });

  // `survey` is a fresh object after every route refresh; its id and edit time say when it changed.
  const surveyKey = `${survey.id}:${String(survey.updatedAt)}`;
  const model = useMemo(() => {
    const data = filterData.data;
    const { elementOptions, elementFilterOptions } = generateElementAndFilterOptions({
      survey,
      environmentTags: data?.environmentTags ?? [],
      attributes: data?.attributes ?? {},
      reservedValues: data?.reservedValues ?? {},
      hiddenFields: data?.hiddenFields ?? {},
      variableValues: data?.variableValues ?? {},
      quotas: data?.quotas ?? [],
      t,
    });
    return buildResponseFilterModel({
      survey,
      elementOptions,
      elementFilterOptions,
      tagNames: (data?.environmentTags ?? []).map((tag) => tag.name),
      t,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `surveyKey` stands in for `survey`
  }, [surveyKey, filterData.data, t]);

  const properties = filterData.data
    ? model.properties
    : [...model.properties, ...pendingProperties(model.properties, globalThis.window?.location.search ?? "")];

  const tableState = useTableUrlState({ properties, sortOptions: [], defaultSortBy: "" });
  const { filters, setFilters, clearFilters } = tableState;
  const filtersKey = JSON.stringify(filters);

  // Resolved once per filter change: "last 24 hours" read against a new `now` on every render would
  // be a new filter on every render.
  const raw = useMemo(
    () => toResponseFilterState(filters, model.fields, timeZone),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `filtersKey` stands in for the filter list
    [filtersKey, model.fields, timeZone]
  );
  const stateKey = JSON.stringify(raw);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the value, so the identity holds while it does
  const state = useMemo<{ selectedFilter: SelectedFilterValue; dateRange: DateRange }>(() => raw, [stateKey]);

  /**
   * The filter as request criteria, with relative dates resolved against this moment. A refresh or a
   * download that runs after midnight in the reporting zone must ask about today, not the day the
   * filter was set; paging through a list keeps `dateRange` so every page shares one window.
   */
  const resolveFreshCriteria = useCallback(() => {
    const fresh = toResponseFilterState(filters, model.fields, timeZone, new Date());
    return getFormattedFilters(survey, fresh.selectedFilter, fresh.dateRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `filtersKey` / `surveyKey` stand in for their objects
  }, [filtersKey, model.fields, timeZone, surveyKey]);

  /**
   * The Summary's "filter by this answer": replaces whatever rules that question had. Returns whether
   * a filter was applied, so the caller only confirms one that was.
   */
  const applyQuestionFilter = useCallback(
    (row: FilterValue): boolean => {
      const rule = filterValueToTableFilter(normalizeSummaryFilterRow(row, t), survey);
      const questionId = row.elementType.id;
      if (!rule || !questionId) return false;
      setFilters([...filters.filter((filter) => !isQuestionFilter(filter, questionId)), rule]);
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `surveyKey` stands in for `survey`
    [filtersKey, setFilters, surveyKey, t]
  );

  return {
    properties,
    filters,
    setFilters: setFilters as (next: TTableFilter[]) => void,
    clearFilters,
    selectedFilter: state.selectedFilter,
    dateRange: state.dateRange,
    hasFilters: filters.length > 0,
    applyQuestionFilter,
    resolveFreshCriteria,
    isFilterDataLoading: filterData.isLoading,
  };
};
