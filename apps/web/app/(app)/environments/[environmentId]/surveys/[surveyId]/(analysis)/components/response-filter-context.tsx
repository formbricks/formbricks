"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  ElementOption,
  ElementOptions,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ElementsComboBox";
import { ElementFilterOptions } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResponseFilter";
import { getTodayDate } from "@/app/lib/surveys/surveys";

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

interface SelectedFilterOptions {
  elementOptions: ElementOptions[];
  elementFilterOptions: ElementFilterOptions[];
}

export interface DateRange {
  from: Date | undefined;
  to?: Date;
}

interface FilterDateContextProps {
  selectedFilter: SelectedFilterValue;
  setSelectedFilter: React.Dispatch<React.SetStateAction<SelectedFilterValue>>;
  selectedOptions: SelectedFilterOptions;
  setSelectedOptions: React.Dispatch<React.SetStateAction<SelectedFilterOptions>>;
  dateRange: DateRange;
  setDateRange: React.Dispatch<React.SetStateAction<DateRange>>;
  resetState: () => void;
  refreshAnalysisData: () => Promise<void>;
  registerAnalysisRefreshHandler: (handler: () => Promise<void>) => () => void;
}

const ResponseFilterContext = createContext<FilterDateContextProps | undefined>(undefined);

const ResponseFilterProvider = ({ children }: { children: React.ReactNode }) => {
  // state holds the filter selected value
  const [selectedFilter, setSelectedFilter] = useState<SelectedFilterValue>({
    filter: [],
    responseStatus: "all",
  });
  // state holds all the options of the responses fetched
  const [selectedOptions, setSelectedOptions] = useState<SelectedFilterOptions>({
    elementFilterOptions: [],
    elementOptions: [],
  });

  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: getTodayDate(),
  });
  const refreshHandlerRef = useRef<(() => Promise<void>) | null>(null);

  const resetState = useCallback(() => {
    setDateRange({
      from: undefined,
      to: getTodayDate(),
    });
    setSelectedFilter({
      filter: [],
      responseStatus: "all",
    });
  }, []);

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
    () => ({
      setSelectedFilter,
      selectedFilter,
      selectedOptions,
      setSelectedOptions,
      dateRange,
      setDateRange,
      resetState,
      refreshAnalysisData,
      registerAnalysisRefreshHandler,
    }),
    [
      dateRange,
      refreshAnalysisData,
      registerAnalysisRefreshHandler,
      resetState,
      selectedFilter,
      selectedOptions,
    ]
  );

  return <ResponseFilterContext.Provider value={contextValue}>{children}</ResponseFilterContext.Provider>;
};

const useResponseFilter = () => {
  const context = useContext(ResponseFilterContext);
  if (context === undefined) {
    throw new Error("useFilterDate must be used within a FilterDateProvider");
  }
  return context;
};

export { ResponseFilterContext, ResponseFilterProvider, useResponseFilter };
