"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { TFilterProperty } from "../lib/types";

/** The property's `availableValues` lookup, shared by every reader of it through the query cache. */
const useAvailableValuesQuery = (property: TFilterProperty | undefined) => {
  const available = property?.availableValues;
  const query = useQuery({
    queryKey: available?.queryKey ?? ["table-filter-available-values", property?.id],
    queryFn: ({ signal }) => available?.load(signal) ?? Promise.resolve({ values: [] }),
    enabled: Boolean(available),
    staleTime: 30_000,
  });
  return available ? query.data : undefined;
};

/**
 * Which of a property's values occur (`availableValues`), once looked up: `null` for a property that does
 * not say, and while the lookup is loading or failed — every value then stays pickable.
 */
export const useAvailableValues = (property: TFilterProperty | undefined): ReadonlySet<string> | null => {
  const values = useAvailableValuesQuery(property)?.values;
  return useMemo(() => (values ? new Set(values) : null), [values]);
};

/** Why a property with no values cannot be filtered by: the lookup's reason, else the property's own. */
export const useEmptyHint = (property: TFilterProperty): string | undefined => {
  const result = useAvailableValuesQuery(property);
  return result?.emptyHint ?? property.availableValues?.emptyHint;
};

/** Whether a value cannot be picked: the lookup says it does not occur, and it is not picked already. */
export const isUnavailableValue = (
  available: ReadonlySet<string> | null,
  value: string,
  selected: readonly string[]
): boolean => available !== null && !available.has(value) && !selected.includes(value);
