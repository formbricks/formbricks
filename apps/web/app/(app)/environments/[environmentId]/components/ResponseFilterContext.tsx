"use client";

import {
  QuestionOption,
  QuestionOptions,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/QuestionsComboBox";
import { QuestionFilterOptions } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResponseFilter";
import { getTodayDate } from "@/app/lib/surveys/surveys";
import React, { createContext, useCallback, useContext, useState } from "react";

export interface FilterValue {
  questionType: Partial<QuestionOption>;
  filterType: {
    filterValue: string | undefined;
    filterComboBoxValue: string | string[] | undefined;
  };
}

export interface SelectedFilterValue {
  filter: FilterValue[];
  onlyComplete: boolean;
}

interface SelectedFilterOptions {
  questionOptions: QuestionOptions[];
  questionFilterOptions: QuestionFilterOptions[];
}

export interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

interface FilterDateContextProps {
  selectedFilter: SelectedFilterValue;
  setSelectedFilter: React.Dispatch<React.SetStateAction<SelectedFilterValue>>;
  selectedOptions: SelectedFilterOptions;
  setSelectedOptions: React.Dispatch<React.SetStateAction<SelectedFilterOptions>>;
  dateRange: DateRange;
  setDateRange: React.Dispatch<React.SetStateAction<DateRange>>;
  resetState: () => void;
}

const ResponseFilterContext = createContext<FilterDateContextProps | undefined>(undefined);

const ResponseFilterProvider = ({ children }: { children: React.ReactNode }) => {
  // state holds the filter selected value
  const [selectedFilter, setSelectedFilter] = useState<SelectedFilterValue>({
    filter: [],
    onlyComplete: false,
  });
  // state holds all the options of the responses fetched
  const [selectedOptions, setSelectedOptions] = useState<SelectedFilterOptions>({
    questionFilterOptions: [],
    questionOptions: [],
  });

  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: getTodayDate(),
  });

  const resetState = useCallback(() => {
    setDateRange({
      from: undefined,
      to: getTodayDate(),
    });
    setSelectedFilter({
      filter: [],
      onlyComplete: false,
    });
  }, []);

  return (
    <ResponseFilterContext.Provider
      value={{
        setSelectedFilter,
        selectedFilter,
        selectedOptions,
        setSelectedOptions,
        dateRange,
        setDateRange,
        resetState,
      }}>
      {children}
    </ResponseFilterContext.Provider>
  );
};

const useResponseFilter = () => {
  const context = useContext(ResponseFilterContext);
  if (context === undefined) {
    throw new Error("useFilterDate must be used within a FilterDateProvider");
  }
  return context;
};

export { ResponseFilterContext, ResponseFilterProvider, useResponseFilter };
