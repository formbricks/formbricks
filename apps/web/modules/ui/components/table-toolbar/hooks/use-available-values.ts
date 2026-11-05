"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { TFilterProperty } from "../lib/types";

/**
 * Which of a property's values occur (`availableValues`), once looked up: `null` for a property that does
 * not say, and while the lookup is loading or failed — every value then stays pickable.
 */
export const useAvailableValues = (property: TFilterProperty | undefined): ReadonlySet<string> | null => {
  const available = property?.availableValues;
  const query = useQuery({
    queryKey: available?.queryKey ?? ["table-filter-available-values", property?.id],
    queryFn: ({ signal }) => available?.load(signal) ?? Promise.resolve([]),
    enabled: Boolean(available),
    staleTime: 30_000,
  });
  const data = available ? query.data : undefined;
  return useMemo(() => (data ? new Set(data) : null), [data]);
};

/** Whether a value cannot be picked: the lookup says it does not occur, and it is not picked already. */
export const isUnavailableValue = (
  available: ReadonlySet<string> | null,
  value: string,
  selected: readonly string[]
): boolean => available !== null && !available.has(value) && !selected.includes(value);
