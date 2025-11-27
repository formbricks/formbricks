"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { ChevronDown, ChevronUp, Plus, TrashIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TI18nString, TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import {
  SelectedFilterValue,
  TResponseStatus,
  useResponseFilter,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import { getSurveyFilterDataAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/actions";
import { QuestionFilterComboBox } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/QuestionFilterComboBox";
import { generateQuestionAndFilterOptions } from "@/app/lib/surveys/surveys";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { Button } from "@/modules/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { OptionsType, QuestionOption, QuestionsComboBox } from "./QuestionsComboBox";

export type QuestionFilterOptions = {
  type:
    | TSurveyQuestionTypeEnum
    | "Attributes"
    | "Tags"
    | "Languages"
    | "Quotas"
    | "Hidden Fields"
    | "Meta"
    | OptionsType.OTHERS;
  filterOptions: (string | TI18nString)[];
  filterComboBoxOptions: (string | TI18nString)[];
  id: string;
};

interface PopoverTriggerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isOpen: boolean;
  children: React.ReactNode;
}

export const PopoverTriggerButton = React.forwardRef<HTMLButtonElement, PopoverTriggerButtonProps>(
  ({ isOpen, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      {...props}
      className="flex min-w-[8rem] cursor-pointer items-center justify-between rounded-md border border-slate-300 bg-white p-2 hover:border-slate-400">
      <span className="text-sm text-slate-700">{children}</span>
      <div className="ml-3">
        {isOpen ? (
          <ChevronUp className="ml-2 h-4 w-4 opacity-50" />
        ) : (
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        )}
      </div>
    </button>
  )
);

PopoverTriggerButton.displayName = "PopoverTriggerButton";

interface ResponseFilterProps {
  survey: TSurvey;
}

export const ResponseFilter = ({ survey }: ResponseFilterProps) => {
  const { t } = useTranslation();
  const [parent] = useAutoAnimate();

  const { selectedFilter, setSelectedFilter, selectedOptions, setSelectedOptions } = useResponseFilter();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [filterValue, setFilterValue] = useState<SelectedFilterValue>(selectedFilter);

  const getDefaultFilterValue = (option?: QuestionFilterOptions): string | undefined => {
    if (!option || option.filterOptions.length === 0) return undefined;
    const firstOption = option.filterOptions[0];
    return typeof firstOption === "object" ? getLocalizedValue(firstOption, "default") : firstOption;
  };

  useEffect(() => {
    // Fetch the initial data for the filter and load it into the state
    const handleInitialData = async () => {
      if (isOpen) {
        const surveyFilterData = await getSurveyFilterDataAction({ surveyId: survey.id });

        if (!surveyFilterData?.data) return;

        const { attributes, meta, environmentTags, hiddenFields, quotas } = surveyFilterData.data;
        const { questionFilterOptions, questionOptions } = generateQuestionAndFilterOptions(
          survey,
          environmentTags,
          attributes,
          meta,
          hiddenFields,
          quotas
        );
        setSelectedOptions({ questionFilterOptions, questionOptions });
      }
    };

    handleInitialData();
  }, [isOpen, setSelectedOptions, survey]);

  const handleOnChangeQuestionComboBoxValue = (value: QuestionOption, index: number) => {
    const matchingFilterOption = selectedOptions.questionFilterOptions.find(
      (q) => q.type === value.type || q.type === value.questionType
    );
    const defaultFilterValue = getDefaultFilterValue(matchingFilterOption);

    if (filterValue.filter[index].questionType) {
      // Create a new array and copy existing values from SelectedFilter
      filterValue.filter[index] = {
        questionType: value,
        filterType: {
          filterComboBoxValue: undefined,
          filterValue: defaultFilterValue,
        },
      };
      setFilterValue({ filter: [...filterValue.filter], responseStatus: filterValue.responseStatus });
    } else {
      // Update the existing value at the specified index
      filterValue.filter[index].questionType = value;
      filterValue.filter[index].filterType = {
        filterComboBoxValue: undefined,
        filterValue: defaultFilterValue,
      };
      setFilterValue({ ...filterValue });
    }
  };

  // when filter is opened and added a filter without selecting any option clear out that value
  const clearItem = () => {
    setFilterValue({
      filter: filterValue.filter.filter((s) => {
        // keep the filter if questionType is selected and filterComboBoxValue is selected
        return s.questionType.hasOwnProperty("label") && s.filterType.filterComboBoxValue?.length;
      }),
      responseStatus: filterValue.responseStatus,
    });
  };

  // remove the added filter if nothing is selected when filter is closed
  useEffect(() => {
    if (!isOpen) {
      clearItem();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleAddNewFilter = () => {
    setFilterValue({
      ...filterValue,
      filter: [
        ...filterValue.filter,
        {
          questionType: {},
          filterType: { filterComboBoxValue: undefined, filterValue: undefined },
        },
      ],
    });
  };

  const handleClearAllFilters = () => {
    const clearedFilters = { filter: [], responseStatus: "all" as const };
    setFilterValue(clearedFilters);
    setSelectedFilter(clearedFilters);
    setIsOpen(false);
  };

  const handleDeleteFilter = (index: number) => {
    filterValue.filter.splice(index, 1);
    setFilterValue({ ...filterValue });
  };

  const handleOnChangeFilterComboBoxValue = (o: string | string[], index: number) => {
    filterValue.filter[index] = {
      ...filterValue.filter[index],
      filterType: {
        filterComboBoxValue: o,
        filterValue: filterValue.filter[index].filterType.filterValue,
      },
    };
    setFilterValue({ ...filterValue });
  };
  const handleOnChangeFilterValue = (o: string, index: number) => {
    filterValue.filter[index] = {
      ...filterValue.filter[index],
      filterType: { filterComboBoxValue: undefined, filterValue: o },
    };
    setFilterValue({ ...filterValue });
  };
  const handleRemoveMultiSelect = (value: string[], index) => {
    filterValue.filter[index] = {
      ...filterValue.filter[index],
      filterType: {
        filterComboBoxValue: value,
        filterValue: filterValue.filter[index].filterType.filterValue,
      },
    };
    setFilterValue({ ...filterValue });
  };

  const handleResponseStatusChange = (responseStatus: TResponseStatus) => {
    setFilterValue({ ...filterValue, responseStatus });
  };

  // remove the filter which has already been selected
  const questionComboBoxOptions = selectedOptions.questionOptions.map((q) => {
    return {
      ...q,
      option: q.option.filter((o) => !filterValue.filter.some((f) => f?.questionType?.id === o?.id)),
    };
  });

  const handleApplyFilters = () => {
    clearItem();
    setSelectedFilter(filterValue);
    setIsOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  useEffect(() => {
    setFilterValue(selectedFilter);
  }, [selectedFilter]);

  const activeFilterCount = filterValue.filter.length + (filterValue.responseStatus === "all" ? 0 : 1);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <PopoverTriggerButton isOpen={isOpen}>
          Filter <b>{activeFilterCount > 0 && `(${activeFilterCount})`}</b>
        </PopoverTriggerButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[300px] rounded-lg border-slate-200 p-6 sm:w-[400px] md:w-[750px] lg:w-[1000px]"
        onOpenAutoFocus={(event) => event.preventDefault()}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-2">
          <p className="font-semibold text-slate-800">
            {t("environments.surveys.summary.show_all_responses_that_match")}
          </p>
          <div className="flex items-center space-x-2">
            <Select
              value={filterValue.responseStatus ?? "all"}
              onValueChange={(val) => {
                handleResponseStatusChange(val as TResponseStatus);
              }}>
              <SelectTrigger className="w-full bg-white text-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="all">
                  {t("environments.surveys.filter.complete_and_partial_responses")}
                </SelectItem>
                <SelectItem value="complete">
                  {t("environments.surveys.filter.complete_responses")}
                </SelectItem>
                <SelectItem value="partial">{t("environments.surveys.filter.partial_responses")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div ref={parent}>
          {filterValue.filter?.map((s, i) => (
            <React.Fragment key={i}>
              <div className="flex w-full flex-wrap gap-3 md:flex-nowrap">
                <div
                  className="grid w-full grid-cols-1 items-center gap-3 md:grid-cols-2"
                  key={`${s.questionType.id}-${i}-${s.questionType.label}`}>
                  <QuestionsComboBox
                    key={`${s.questionType.label}-${i}-${s.questionType.id}`}
                    options={questionComboBoxOptions}
                    selected={s.questionType}
                    onChangeValue={(value) => handleOnChangeQuestionComboBoxValue(value, i)}
                  />
                  <QuestionFilterComboBox
                    key={`${s.questionType.id}-${i}`}
                    filterOptions={
                      selectedOptions.questionFilterOptions.find(
                        (q) =>
                          (q.type === s.questionType.questionType || q.type === s.questionType.type) &&
                          q.id === s.questionType.id
                      )?.filterOptions
                    }
                    filterComboBoxOptions={
                      selectedOptions.questionFilterOptions.find(
                        (q) =>
                          (q.type === s.questionType.questionType || q.type === s.questionType.type) &&
                          q.id === s.questionType.id
                      )?.filterComboBoxOptions
                    }
                    filterValue={filterValue.filter[i].filterType.filterValue}
                    filterComboBoxValue={filterValue.filter[i].filterType.filterComboBoxValue}
                    type={
                      s?.questionType?.type === OptionsType.QUESTIONS
                        ? s?.questionType?.questionType
                        : s?.questionType?.type
                    }
                    fieldId={s?.questionType?.id}
                    handleRemoveMultiSelect={(value) => handleRemoveMultiSelect(value, i)}
                    onChangeFilterComboBoxValue={(value) => handleOnChangeFilterComboBoxValue(value, i)}
                    onChangeFilterValue={(value) => handleOnChangeFilterValue(value, i)}
                    disabled={!s?.questionType?.label}
                  />
                </div>
                <div className="flex w-full items-center justify-end gap-1 md:w-auto">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => handleDeleteFilter(i)}
                    aria-label={t("common.delete")}>
                    <TrashIcon />
                  </Button>
                </div>
              </div>
              {i !== filterValue.filter.length - 1 && (
                <div className="my-4 flex items-center">
                  <p className="mr-4 font-semibold text-slate-800">and</p>
                  <hr className="w-full text-slate-600" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleAddNewFilter}>
              {t("common.add_filter")}
              <Plus />
            </Button>
            <Button size="sm" onClick={handleApplyFilters}>
              {t("common.apply_filters")}
            </Button>
          </div>
          <Button size="sm" variant="destructive" onClick={handleClearAllFilters}>
            {t("common.clear_all")}
            <TrashIcon />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
