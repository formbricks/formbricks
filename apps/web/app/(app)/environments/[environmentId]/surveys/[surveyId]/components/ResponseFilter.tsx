"use client";

import {
  SelectedFilterValue,
  TResponseStatus,
  useResponseFilter,
} from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getSurveyFilterDataAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/actions";
import { QuestionFilterComboBox } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/QuestionFilterComboBox";
import { generateQuestionAndFilterOptions } from "@/app/lib/surveys/surveys";
import { Button } from "@/modules/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useTranslate } from "@tolgee/react";
import { ChevronDown, ChevronUp, Plus, TrashIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { OptionsType, QuestionOption, QuestionsComboBox } from "./QuestionsComboBox";

export type QuestionFilterOptions = {
  type: TSurveyQuestionTypeEnum | "Attributes" | "Tags" | "Languages";
  filterOptions: string[];
  filterComboBoxOptions: string[];
  id: string;
};

interface ResponseFilterProps {
  survey: TSurvey;
}

export const ResponseFilter = ({ survey }: ResponseFilterProps) => {
  const { t } = useTranslate();
  const [parent] = useAutoAnimate();

  const { selectedFilter, setSelectedFilter, selectedOptions, setSelectedOptions } = useResponseFilter();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [filterValue, setFilterValue] = useState<SelectedFilterValue>(selectedFilter);

  useEffect(() => {
    // Fetch the initial data for the filter and load it into the state
    const handleInitialData = async () => {
      if (isOpen) {
        const surveyFilterData = await getSurveyFilterDataAction({ surveyId: survey.id });

        if (!surveyFilterData?.data) return;

        const { attributes, meta, environmentTags, hiddenFields } = surveyFilterData.data;
        const { questionFilterOptions, questionOptions } = generateQuestionAndFilterOptions(
          survey,
          environmentTags,
          attributes,
          meta,
          hiddenFields
        );
        setSelectedOptions({ questionFilterOptions, questionOptions });
      }
    };

    handleInitialData();
  }, [isOpen, setSelectedOptions, survey]);

  const handleOnChangeQuestionComboBoxValue = (value: QuestionOption, index: number) => {
    if (filterValue.filter[index].questionType) {
      // Create a new array and copy existing values from SelectedFilter
      filterValue.filter[index] = {
        questionType: value,
        filterType: {
          filterComboBoxValue: undefined,
          filterValue: selectedOptions.questionFilterOptions.find(
            (q) => q.type === value.type || q.type === value.questionType
          )?.filterOptions[0],
        },
      };
      setFilterValue({ filter: [...filterValue.filter], responseStatus: filterValue.responseStatus });
    } else {
      // Update the existing value at the specified index
      filterValue.filter[index].questionType = value;
      filterValue.filter[index].filterType = {
        filterComboBoxValue: undefined,
        filterValue: selectedOptions.questionFilterOptions.find(
          (q) => q.type === value.type || q.type === value.questionType
        )?.filterOptions[0],
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
      handleApplyFilters();
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
    setFilterValue((filterValue) => ({ ...filterValue, filter: [], responseStatus: "all" }));
    setSelectedFilter((selectedFilters) => ({ ...selectedFilters, filter: [], responseStatus: "all" }));
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
    if (!open) {
      handleApplyFilters();
    }
    setIsOpen(open);
  };

  useEffect(() => {
    setFilterValue(selectedFilter);
  }, [selectedFilter]);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger className="flex min-w-[8rem] items-center justify-between rounded border border-slate-200 bg-white p-3 text-sm text-slate-600 hover:border-slate-300 sm:min-w-[11rem] sm:px-6 sm:py-3">
        <span>
          Filter <b>{filterValue.filter.length > 0 && `(${filterValue.filter.length})`}</b>
        </span>
        <div className="ml-3">
          {isOpen ? (
            <ChevronUp className="ml-2 h-4 w-4 opacity-50" />
          ) : (
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[300px] border-slate-200 bg-slate-100 p-6 sm:w-[400px] md:w-[750px] lg:w-[1000px]"
        onOpenAutoFocus={(event) => event.preventDefault()}>
        <div className="mb-8 flex flex-wrap items-start justify-between gap-2">
          <p className="text-slate800 hidden text-lg font-semibold sm:block">
            {t("environments.surveys.summary.show_all_responses_that_match")}
          </p>
          <p className="block text-base text-slate-500 sm:hidden">
            {t("environments.surveys.summary.show_all_responses_where")}
          </p>
          <div className="flex items-center space-x-2">
            <Select
              onValueChange={(val) => {
                handleResponseStatusChange(val as TResponseStatus);
              }}
              defaultValue={filterValue.responseStatus}>
              <SelectTrigger className="w-full bg-white">
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
                  key={`${s.questionType.id}-${i}`}>
                  <QuestionsComboBox
                    key={`${s.questionType.label}-${i}`}
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
                    handleRemoveMultiSelect={(value) => handleRemoveMultiSelect(value, i)}
                    onChangeFilterComboBoxValue={(value) => handleOnChangeFilterComboBoxValue(value, i)}
                    onChangeFilterValue={(value) => handleOnChangeFilterValue(value, i)}
                    disabled={!s?.questionType?.label}
                  />
                </div>
                <div className="flex w-full items-center justify-end gap-1 md:w-auto">
                  <p className="block font-light text-slate-500 md:hidden">Delete</p>
                  <TrashIcon
                    className="w-4 cursor-pointer text-slate-500 md:text-black"
                    onClick={() => handleDeleteFilter(i)}
                  />
                </div>
              </div>
              {i !== filterValue.filter.length - 1 && (
                <div className="my-6 flex items-center">
                  <p className="mr-6 text-base text-slate-600">And</p>
                  <hr className="w-full text-slate-600" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-between">
          <Button size="sm" variant="secondary" onClick={handleAddNewFilter}>
            {t("common.add_filter")}
            <Plus width={18} height={18} className="ml-2" />
          </Button>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleApplyFilters}>
              {t("common.apply_filters")}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleClearAllFilters}>
              {t("common.clear_all")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
