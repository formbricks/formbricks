"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/ResponseFilterContext";
import QuestionFilterComboBox from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/QuestionFilterComboBox";
import { TSurveyQuestionType } from "@formbricks/types/v1/surveys";
import { Button, Checkbox, Popover, PopoverContent, PopoverTrigger } from "@formbricks/ui";
import { TrashIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import QuestionsComboBox, { OptionsType, QuestionOption } from "./QuestionsComboBox";

export type QuestionFilterOptions = {
  type: TSurveyQuestionType | "Attributes" | "Tags";
  filterOptions: string[];
  filterComboBoxOptions: string[];
  id: string;
};

const ResponseFilter = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { selectedFilter, setSelectedFilter, selectedOptions } = useResponseFilter();

  const handleOnChangeQuestionComboBoxValue = (value: QuestionOption, index: number) => {
    if (selectedFilter.filter[index].questionType) {
      // Create a new array and copy existing values from SelectedFilter
      selectedFilter.filter[index] = {
        questionType: value,
        filterType: {
          filterComboBoxValue: undefined,
          filterValue: selectedOptions.questionFilterOptions.find(
            (q) => q.type === value.type || q.type === value.questionType
          )?.filterOptions[0],
        },
      };
      setSelectedFilter({ filter: [...selectedFilter.filter], onlyComplete: selectedFilter.onlyComplete });
    } else {
      // Update the existing value at the specified index
      selectedFilter.filter[index].questionType = value;
      selectedFilter.filter[index].filterType = {
        filterComboBoxValue: undefined,
        filterValue: selectedOptions.questionFilterOptions.find(
          (q) => q.type === value.type || q.type === value.questionType
        )?.filterOptions[0],
      };
      setSelectedFilter({ ...selectedFilter });
    }
  };

  // when filter is opened and added a filter without selecting any option clear out that value
  const clearItem = () => {
    setSelectedFilter({
      filter: [...selectedFilter.filter.filter((s) => s.questionType.hasOwnProperty("label"))],
      onlyComplete: selectedFilter.onlyComplete,
    });
  };

  // remove the added filter if nothing is selected when filter is closed
  useEffect(() => {
    if (!isOpen) {
      clearItem();
    }
  }, [isOpen]);

  const handleAddNewFilter = () => {
    setSelectedFilter({
      ...selectedFilter,
      filter: [
        ...selectedFilter.filter,
        {
          questionType: {},
          filterType: { filterComboBoxValue: undefined, filterValue: undefined },
        },
      ],
    });
  };

  const handleClearAllFilters = () => {
    setSelectedFilter({ ...selectedFilter, filter: [] });
  };

  const handleDeleteFilter = (index: number) => {
    selectedFilter.filter.splice(index, 1);
    setSelectedFilter({ ...selectedFilter });
  };

  const handleOnChangeFilterComboBoxValue = (o: string | string[], index: number) => {
    selectedFilter.filter[index] = {
      ...selectedFilter.filter[index],
      filterType: {
        filterComboBoxValue: o,
        filterValue: selectedFilter.filter[index].filterType.filterValue,
      },
    };
    setSelectedFilter({ ...selectedFilter });
  };
  const handleOnChangeFilterValue = (o: string, index: number) => {
    selectedFilter.filter[index] = {
      ...selectedFilter.filter[index],
      filterType: { filterComboBoxValue: undefined, filterValue: o },
    };
    setSelectedFilter({ ...selectedFilter });
  };
  const handleRemoveMultiSelect = (value: string[], index) => {
    selectedFilter.filter[index] = {
      ...selectedFilter.filter[index],
      filterType: {
        filterComboBoxValue: value,
        filterValue: selectedFilter.filter[index].filterType.filterValue,
      },
    };
    setSelectedFilter({ ...selectedFilter });
  };

  const handleCheckOnlyComplete = (checked: boolean) => {
    setSelectedFilter({ ...selectedFilter, onlyComplete: checked });
  };

  // remove the filter which has already been selected
  const questionComboBoxOptions = selectedOptions.questionOptions.map((q) => {
    return {
      ...q,
      option: q.option.filter((o) => !selectedFilter.filter.some((f) => f?.questionType?.id === o?.id)),
    };
  });

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger className="flex min-w-[8rem] items-center justify-between rounded border border-slate-200 bg-slate-100 p-3 text-sm text-slate-600 hover:border-slate-300 sm:min-w-[11rem] sm:px-6 sm:py-3">
        Filter {selectedFilter.filter.length > 0 && `(${selectedFilter.filter.length})`}
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
        className="w-[300px] border-slate-200  bg-slate-100 p-6 sm:w-[400px] md:w-[750px] lg:w-[1000px] ">
        <div className="mb-8 flex flex-wrap items-start justify-between">
          <p className="hidden text-lg font-bold text-black sm:block">Show all responses that match</p>
          <p className="block text-base  text-slate-500 sm:hidden">Show all responses where...</p>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-normal text-slate-600">Only completed</label>
            <Checkbox
              className={clsx("rounded-md", selectedFilter.onlyComplete && "bg-black text-white")}
              checked={selectedFilter.onlyComplete}
              onCheckedChange={(checked) => {
                typeof checked === "boolean" && handleCheckOnlyComplete(checked);
              }}
            />
          </div>
        </div>
        {selectedFilter.filter?.map((s, i) => (
          <>
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
                      (q) => q.type === s.questionType.type || q.type === s.questionType.questionType
                    )?.filterOptions
                  }
                  filterComboBoxOptions={
                    selectedOptions.questionFilterOptions.find(
                      (q) =>
                        (q.type === s.questionType.questionType || q.type === s.questionType.type) &&
                        q.id === s.questionType.id
                    )?.filterComboBoxOptions
                  }
                  filterValue={selectedFilter.filter[i].filterType.filterValue}
                  filterComboBoxValue={selectedFilter.filter[i].filterType.filterComboBoxValue}
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
            {i !== selectedFilter.filter.length - 1 && (
              <div className="my-6 flex items-center">
                <p className="mr-6 text-base text-slate-600">And</p>
                <hr className="w-full text-slate-600" />
              </div>
            )}
          </>
        ))}
        <div className="mt-8 flex items-center justify-between">
          <Button size="sm" variant="darkCTA" onClick={handleAddNewFilter}>
            Add filter
            <Plus width={18} height={18} className="ml-2" />
          </Button>
          <Button size="sm" variant="secondary" onClick={handleClearAllFilters}>
            Clear all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ResponseFilter;
