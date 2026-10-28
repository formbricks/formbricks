"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
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
  applicableResponseFilters,
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

/** Properties the survey alone describes; every other one (attributes, tags, meta…) needs the filter data. */
const isSurveyOnlyProperty = (id: string) =>
  id === "status" || id === "createdAt" || id === "language" || id.startsWith("question.");

/** Whether the URL's filter names a property only the filter data can describe. */
const urlNeedsFilterData = (search: URLSearchParams) =>
  [...search.keys()].some((key) => {
    const id = FILTER_KEY_PATTERN.exec(key)?.[1];
    return id !== undefined && !isSurveyOnlyProperty(id);
  });

/**
 * The Responses / Summary filter, kept in the page URL so it follows a tab switch, a reload and a shared
 * link (ADR 0015). It hands the pages the same `selectedFilter` / `dateRange` the response pipeline
 * always read, with an identity that only changes when the filter does: every server action refreshes
 * the route, and a filter that changed identity on each refresh would refetch forever.
 */
export const useResponseTableFilters = (survey: TSurvey) => {
  const { t } = useTranslation();
  const { organization } = useOrganization();
  const timeZone = getReportingTimeZone(organization?.displayTimeZone);

  // The filter data reads every response of the survey for its observed values, so it is fetched only
  // once the filter is opened, or when the URL already names a property that needs it.
  const searchParams = useSearchParams();
  const needsFilterData = urlNeedsFilterData(new URLSearchParams(searchParams?.toString() ?? ""));
  const [isFilterDataRequested, setIsFilterDataRequested] = useState(false);
  const filterData = useQuery({
    queryKey: surveyFilterDataKey(survey.id),
    queryFn: async () => {
      const result = await getSurveyFilterDataAction({ surveyId: survey.id });
      if (!result?.data) throw new Error(result?.serverError ?? "filter data unavailable");
      return result.data;
    },
    enabled: needsFilterData || isFilterDataRequested,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const requestFilterData = useCallback(() => setIsFilterDataRequested(true), []);
  const isFilterDataError = needsFilterData && filterData.isError;
  useEffect(() => {
    if (isFilterDataError) toast.error(t("common.something_went_wrong_please_try_again"));
  }, [isFilterDataError, t]);

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
  const { setFilters, clearFilters } = tableState;
  const urlFiltersKey = JSON.stringify(tableState.filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialized filters
  const filters = useMemo(() => applicableResponseFilters(tableState.filters), [urlFiltersKey]);
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
    requestFilterData,
    /**
     * False while a rule in the URL waits for the filter data that resolves it. Until then the list,
     * the count and the downloads must not run, or they would answer for the unfiltered survey.
     */
    isReady: !needsFilterData || filterData.isSuccess,
    isFilterDataError,
  };
};
