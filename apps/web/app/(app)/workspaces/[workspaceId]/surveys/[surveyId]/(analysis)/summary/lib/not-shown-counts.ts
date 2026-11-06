"use client";

import { createContext, useContext } from "react";
import { TSurveySummary } from "@formbricks/types/surveys/types";

/**
 * "Not shown to N" per element (ENG-6936), read by every element card's header. Provided once by the
 * summary list from the drop-off entries, so the fifteen element summaries need no extra prop.
 */
const NotShownCountsContext = createContext<Readonly<Record<string, number>>>({});

export const NotShownCountsProvider = NotShownCountsContext.Provider;

/** Element id → respondents it was not shown to, for the elements shown to fewer than everyone. */
export const getNotShownCounts = (dropOff: TSurveySummary["dropOff"]): Record<string, number> =>
  Object.fromEntries(
    dropOff.filter((entry) => entry.notShownCount > 0).map((entry) => [entry.elementId, entry.notShownCount])
  );

export const useNotShownCount = (elementId: string): number =>
  useContext(NotShownCountsContext)[elementId] ?? 0;
