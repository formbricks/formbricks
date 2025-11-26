"use client";

import clsx from "clsx";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TI18nString, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { OptionsType } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/QuestionsComboBox";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { useClickOutside } from "@/lib/utils/hooks/useClickOutside";
import { Button } from "@/modules/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/modules/ui/components/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Input } from "@/modules/ui/components/input";

type QuestionFilterComboBoxProps = {
  filterOptions: (string | TI18nString)[] | undefined;
  filterComboBoxOptions: (string | TI18nString)[] | undefined;
  filterValue: string | undefined;
  filterComboBoxValue: string | string[] | undefined;
  onChangeFilterValue: (o: string) => void;
  onChangeFilterComboBoxValue: (o: string | string[]) => void;
  type?: TSurveyQuestionTypeEnum | Omit<OptionsType, OptionsType.QUESTIONS>;
  handleRemoveMultiSelect: (value: string[]) => void;
  disabled?: boolean;
  fieldId?: string;
};

export const QuestionFilterComboBox = ({
  filterComboBoxOptions,
  filterComboBoxValue,
  filterOptions,
  filterValue,
  onChangeFilterComboBoxValue,
  onChangeFilterValue,
  type,
  handleRemoveMultiSelect,
  disabled = false,
  fieldId,
}: QuestionFilterComboBoxProps) => {
  const [open, setOpen] = useState(false);
  const commandRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useTranslation();

  useClickOutside(commandRef, () => setOpen(false));

  const defaultLanguageCode = "default";

  // Check if multiple selection is allowed
  const isMultiple = useMemo(
    () =>
      type === TSurveyQuestionTypeEnum.MultipleChoiceMulti ||
      type === TSurveyQuestionTypeEnum.MultipleChoiceSingle ||
      type === TSurveyQuestionTypeEnum.PictureSelection ||
      (type === TSurveyQuestionTypeEnum.NPS && filterValue === "Includes either"),
    [type, filterValue]
  );

  // Filter out already selected options for multi-select
  const options = useMemo(() => {
    if (!isMultiple) return filterComboBoxOptions;

    return filterComboBoxOptions?.filter((o) => {
      const optionValue = typeof o === "object" && o !== null ? getLocalizedValue(o, defaultLanguageCode) : o;
      return !filterComboBoxValue?.includes(optionValue);
    });
  }, [isMultiple, filterComboBoxOptions, filterComboBoxValue, defaultLanguageCode]);

  // Disable combo box for NPS/Rating when Submitted/Skipped
  const isDisabledComboBox =
    (type === TSurveyQuestionTypeEnum.NPS || type === TSurveyQuestionTypeEnum.Rating) &&
    (filterValue === "Submitted" || filterValue === "Skipped");

  // Check if this is a text input field (URL meta field)
  const isTextInputField = type === OptionsType.META && fieldId === "url";

  // Filter options based on search query
  const filteredOptions = useMemo(
    () =>
      options?.filter((o) => {
        const optionValue =
          typeof o === "object" && o !== null ? getLocalizedValue(o, defaultLanguageCode) : o;
        return optionValue.toLowerCase().includes(searchQuery.toLowerCase());
      }),
    [options, searchQuery, defaultLanguageCode]
  );

  const handleCommandItemSelect = (o: string | TI18nString) => {
    const value = typeof o === "object" && o !== null ? getLocalizedValue(o, defaultLanguageCode) : o;

    if (isMultiple) {
      const newValue = Array.isArray(filterComboBoxValue) ? [...filterComboBoxValue, value] : [value];
      onChangeFilterComboBoxValue(newValue);
      return;
    }

    onChangeFilterComboBoxValue(value);
    setOpen(false);
  };

  const isComboBoxDisabled = disabled || isDisabledComboBox || !filterValue;

  const handleOpenDropdown = () => {
    if (isComboBoxDisabled) return;
    setOpen(true);
  };
  const ChevronIcon = open ? ChevronUp : ChevronDown;

  // Helper to filter out a specific value from the array
  const getFilteredValues = (valueToRemove: string): string[] => {
    if (!Array.isArray(filterComboBoxValue)) return [];
    return filterComboBoxValue.filter((i) => i !== valueToRemove);
  };

  // Handle removal of a multi-select tag
  const handleRemoveTag = (e: React.MouseEvent, valueToRemove: string) => {
    e.stopPropagation();
    const filteredValues = getFilteredValues(valueToRemove);
    handleRemoveMultiSelect(filteredValues);
  };

  // Render a single multi-select tag
  const renderTag = (value: string, index: number) => (
    <button
      key={`${value}-${index}`}
      type="button"
      onClick={(e) => handleRemoveTag(e, value)}
      className="flex items-center gap-1 whitespace-nowrap rounded bg-slate-100 px-2 py-1 text-sm text-slate-600 hover:bg-slate-200">
      {value}
      <X className="h-3 w-3" />
    </button>
  );

  // Render multi-select tags
  const renderMultiSelectTags = () => {
    if (!Array.isArray(filterComboBoxValue) || filterComboBoxValue.length === 0) {
      return null;
    }

    return (
      <div className="no-scrollbar flex grow gap-2 overflow-auto">
        {filterComboBoxValue.map((value, index) => renderTag(value, index))}
      </div>
    );
  };

  // Render the appropriate content based on filterComboBoxValue state
  const renderComboBoxContent = () => {
    if (!filterComboBoxValue || filterComboBoxValue.length === 0) {
      return (
        <p className={clsx("text-sm", isComboBoxDisabled ? "text-slate-300" : "text-slate-400")}>
          {t("common.select")}...
        </p>
      );
    }

    if (Array.isArray(filterComboBoxValue)) {
      return renderMultiSelectTags();
    }

    return <p className="truncate text-sm text-slate-600">{filterComboBoxValue}</p>;
  };

  return (
    <div className="inline-flex h-fit w-full flex-row rounded-md border border-slate-300 hover:border-slate-400">
      {filterOptions && filterOptions.length <= 1 ? (
        <div className="flex h-9 max-w-fit items-center rounded-md rounded-r-none border-r border-slate-300 bg-white px-2 text-sm text-slate-600">
          <p className="mr-1 max-w-[50px] truncate sm:max-w-[100px]">{filterValue}</p>
        </div>
      ) : (
        <DropdownMenu
          onOpenChange={(value) => {
            if (value) setOpen(false);
          }}>
          <DropdownMenuTrigger
            disabled={disabled}
            className={clsx(
              "flex h-9 max-w-fit items-center justify-between gap-2 rounded-md rounded-r-none border-r border-slate-300 bg-white px-2 text-sm text-slate-600 focus:outline-transparent focus:ring-0",
              disabled ? "opacity-50" : "cursor-pointer hover:bg-slate-50"
            )}>
            {filterValue ? (
              <p className="max-w-[50px] truncate sm:max-w-[80px]">{filterValue}</p>
            ) : (
              <p className="text-slate-400">{t("common.select")}...</p>
            )}
            {filterOptions && filterOptions.length > 1 && (
              <ChevronIcon className="h-4 w-4 flex-shrink-0 opacity-50" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-white">
            {filterOptions?.map((o, index) => {
              const optionValue =
                typeof o === "object" && o !== null ? getLocalizedValue(o, defaultLanguageCode) : o;
              return (
                <DropdownMenuItem
                  key={`${optionValue}-${index}`}
                  className="cursor-pointer"
                  onClick={() => onChangeFilterValue(optionValue)}>
                  {optionValue}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {isTextInputField ? (
        <Input
          type="text"
          value={typeof filterComboBoxValue === "string" ? filterComboBoxValue : ""}
          onChange={(e) => onChangeFilterComboBoxValue(e.target.value)}
          disabled={isComboBoxDisabled}
          placeholder={t("common.enter_url")}
          className="h-9 rounded-l-none border-none bg-white text-sm focus:ring-offset-0"
        />
      ) : (
        <Command ref={commandRef} className="relative h-fit w-full min-w-0 overflow-visible bg-transparent">
          {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role */}
          <div
            role="button"
            tabIndex={isComboBoxDisabled ? -1 : 0}
            className={clsx(
              "flex min-w-0 items-center gap-2 rounded-md rounded-l-none bg-white pl-2",
              isComboBoxDisabled ? "opacity-50" : "cursor-pointer hover:bg-slate-50"
            )}
            onClick={handleOpenDropdown}
            onKeyDown={(e) => {
              const isActivationKey = e.key === "Enter" || e.key === " ";
              if (isActivationKey && !isComboBoxDisabled) {
                e.preventDefault();
                handleOpenDropdown();
              }
            }}>
            <div className="min-w-0 flex-1">{renderComboBoxContent()}</div>

            <Button
              onClick={(e) => {
                e.stopPropagation();
                if (isComboBoxDisabled) return;
                setOpen(!open);
              }}
              disabled={isComboBoxDisabled}
              variant="secondary"
              size="icon"
              className="flex-shrink-0"
              aria-expanded={open}
              aria-label={t("common.select")}>
              <ChevronIcon />
            </Button>
          </div>

          {open && (
            <div className="animate-in absolute top-full z-10 mt-1 w-full overflow-auto rounded-md bg-white shadow-md outline-none">
              <CommandList className="max-h-52">
                <CommandInput
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  placeholder={`${t("common.search")}...`}
                  className="border-none"
                />
                <CommandEmpty>{t("common.no_result_found")}</CommandEmpty>
                <CommandGroup>
                  {filteredOptions?.map((o) => {
                    const optionValue =
                      typeof o === "object" && o !== null ? getLocalizedValue(o, defaultLanguageCode) : o;
                    return (
                      <CommandItem
                        key={optionValue}
                        onSelect={() => handleCommandItemSelect(o)}
                        className="cursor-pointer">
                        {optionValue}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </div>
          )}
        </Command>
      )}
    </div>
  );
};
