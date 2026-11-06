"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getFilterValuesQuery } from "../lib/filter-values-query";
import type { TFilterProperty } from "../lib/types";
import { collectValueLabels, valuesToLabel, valuesToSearch } from "../lib/value-labels";

const LABEL_STALE_MS = 30_000;

/**
 * The property with the labels of `values` (`valueLabels`), for a property whose listed values are ids
 * shown by a label (`labelledValues`): looked up in its value list — the unsearched first page, shared with
 * the picker through the query cache, then a search for each value it does not hold. Any other property is
 * returned as it is, and so is each value not found: named by its stored text.
 */
export const useLabelledProperty = (
  property: TFilterProperty,
  values: readonly string[]
): TFilterProperty => {
  const wanted = valuesToLabel(property, values);
  const first = useQuery({
    ...getFilterValuesQuery(property, ""),
    enabled: wanted.length > 0,
    staleTime: LABEL_STALE_MS,
  });
  const searched = useQueries({
    queries: valuesToSearch(wanted, first.data).map((value) => ({
      ...getFilterValuesQuery(property, value),
      staleTime: LABEL_STALE_MS,
    })),
  });
  const labels = collectValueLabels(wanted, [first.data, ...searched.map((query) => query.data)]);
  const labelsKey = JSON.stringify(labels);

  return useMemo(() => {
    if (labelsKey === "{}") return property;
    return { ...property, valueLabels: JSON.parse(labelsKey) as Record<string, string> };
  }, [property, labelsKey]);
};
