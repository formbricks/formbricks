"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { type ElementOption } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/components/response-filter-options";
import { type TDateRangePreset } from "@/lib/date-ranges";

// The filter itself lives in the page URL (`useResponseTableFilters`), shared by Responses and Summary.
// What is left here is the refresh hook-up: the survey header's actions refresh whichever tab is open.

export interface FilterValue {
  elementType: Partial<ElementOption>;
  filterType: {
    filterValue: string | undefined;
    filterComboBoxValue: string | string[] | undefined;
  };
}

export type TResponseStatus = "all" | "complete" | "partial";

export interface SelectedFilterValue {
  filter: FilterValue[];
  responseStatus: TResponseStatus;
}

export interface DateRange {
  from: Date | undefined;
  to?: Date;
  /** Which preset produced this range, if any. */
  preset?: TDateRangePreset;
}

interface ResponseFilterContextProps {
  refreshAnalysisData: () => Promise<void>;
  registerAnalysisRefreshHandler: (handler: () => Promise<void>) => () => void;
}

const ResponseFilterContext = createContext<ResponseFilterContextProps | undefined>(undefined);

const ResponseFilterProvider = ({ children }: { children: React.ReactNode }) => {
  const refreshHandlerRef = useRef<(() => Promise<void>) | null>(null);

  const refreshAnalysisData = useCallback(async () => {
    await refreshHandlerRef.current?.();
  }, []);

  const registerAnalysisRefreshHandler = useCallback((handler: () => Promise<void>) => {
    refreshHandlerRef.current = handler;

    return () => {
      if (refreshHandlerRef.current === handler) {
        refreshHandlerRef.current = null;
      }
    };
  }, []);

  const contextValue = useMemo(
    () => ({ refreshAnalysisData, registerAnalysisRefreshHandler }),
    [refreshAnalysisData, registerAnalysisRefreshHandler]
  );

  return <ResponseFilterContext.Provider value={contextValue}>{children}</ResponseFilterContext.Provider>;
};

const useResponseFilter = () => {
  const context = useContext(ResponseFilterContext);
  if (context === undefined) {
    throw new Error("useResponseFilter must be used within a ResponseFilterProvider");
  }
  return context;
};

export { ResponseFilterContext, ResponseFilterProvider, useResponseFilter };
