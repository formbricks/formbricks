"use client";

import { TFunction } from "i18next";
import { ChevronDownIcon, X } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "react-use";
import type { TProjectConfigChannel } from "@formbricks/types/project";
import type { TFilterOption, TSortOption } from "@formbricks/types/surveys/types";
import { SortOption } from "@/modules/survey/list/components/sort-option";
import { initialFilters } from "@/modules/survey/list/lib/constants";
import { TSurveyOverviewFilters } from "@/modules/survey/list/types/survey-overview";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { SearchBar } from "@/modules/ui/components/search-bar";
import { SurveyFilterDropdown } from "./survey-filter-dropdown";

interface SurveyFilterProps {
  surveyFilters: TSurveyOverviewFilters;
  setSurveyFilters: Dispatch<SetStateAction<TSurveyOverviewFilters>>;
  currentProjectChannel: TProjectConfigChannel;
}

const getStatusOptions = (t: TFunction): TFilterOption[] => [
  { label: t("common.draft"), value: "draft" },
  { label: t("common.in_progress"), value: "inProgress" },
  { label: t("common.paused"), value: "paused" },
  { label: t("common.completed"), value: "completed" },
];

const getSortOptions = (t: TFunction): TSortOption[] => [
  {
    label: t("common.updated_at"),
    value: "updatedAt",
  },
  {
    label: t("common.created_at"),
    value: "createdAt",
  },
  {
    label: t("environments.surveys.alphabetical"),
    value: "name",
  },
  {
    label: t("environments.surveys.relevance"),
    value: "relevance",
  },
];

export const SurveyFilters = ({
  surveyFilters,
  setSurveyFilters,
  currentProjectChannel,
}: SurveyFilterProps) => {
  const { sortBy, status, type } = surveyFilters;
  const [name, setName] = useState(surveyFilters.name);
  const { t } = useTranslation();
  useDebounce(() => setSurveyFilters((prev) => ({ ...prev, name })), 800, [name]);

  const [dropdownOpenStates, setDropdownOpenStates] = useState(new Map());

  const typeOptions: TFilterOption[] = [
    { label: t("common.link"), value: "link" },
    { label: t("common.app"), value: "app" },
  ];

  useEffect(() => {
    setName(surveyFilters.name);
  }, [surveyFilters.name]);

  const toggleDropdown = (id: string) => {
    setDropdownOpenStates(new Map(dropdownOpenStates).set(id, !dropdownOpenStates.get(id)));
  };

  const handleStatusChange = (value: string) => {
    if (value === "inProgress" || value === "paused" || value === "completed" || value === "draft") {
      if (status.includes(value)) {
        setSurveyFilters((prev) => ({ ...prev, status: prev.status.filter((v) => v !== value) }));
      } else {
        setSurveyFilters((prev) => ({ ...prev, status: [...prev.status, value] }));
      }
    }
  };

  const handleTypeChange = (value: string) => {
    if (value === "link" || value === "app") {
      if (type.includes(value)) {
        setSurveyFilters((prev) => ({ ...prev, type: prev.type.filter((v) => v !== value) }));
      } else {
        setSurveyFilters((prev) => ({ ...prev, type: [...prev.type, value] }));
      }
    }
  };

  const handleSortChange = (option: TSortOption) => {
    setSurveyFilters((prev) => ({ ...prev, sortBy: option.value }));
  };

  return (
    <div className="flex justify-between">
      <div className="flex space-x-2">
        <SearchBar
          value={name}
          onChange={setName}
          placeholder={t("environments.surveys.search_by_survey_name")}
          className="border-slate-700"
        />
        <div>
          <SurveyFilterDropdown
            title={t("common.status")}
            id="status"
            options={getStatusOptions(t)}
            selectedOptions={status}
            setSelectedOptions={handleStatusChange}
            isOpen={dropdownOpenStates.get("status")}
            toggleDropdown={toggleDropdown}
          />
        </div>
        {currentProjectChannel !== "link" && (
          <div>
            <SurveyFilterDropdown
              title={t("common.type")}
              id="type"
              options={typeOptions}
              selectedOptions={type}
              setSelectedOptions={handleTypeChange}
              isOpen={dropdownOpenStates.get("type")}
              toggleDropdown={toggleDropdown}
            />
          </div>
        )}

        {(status.length > 0 || type.length > 0 || name) && (
          <Button
            size="sm"
            onClick={() => {
              setSurveyFilters(initialFilters);
              setName(initialFilters.name);
            }}
            className="h-8">
            {t("common.clear_filters")}
            <X />
          </Button>
        )}
      </div>
      <div className="flex space-x-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            asChild
            className="surveyFilterDropdown h-full cursor-pointer border border-slate-700 outline-none hover:bg-slate-900">
            <div className="min-w-auto h-8 rounded-md border sm:flex sm:px-2">
              <div className="hidden w-full items-center justify-between hover:text-white sm:flex">
                <span className="text-sm">
                  {t("common.sort_by")}:{" "}
                  {getSortOptions(t).find((option) => option.value === sortBy)
                    ? getSortOptions(t).find((option) => option.value === sortBy)?.label
                    : ""}
                </span>
                <ChevronDownIcon className="ml-2 h-4 w-4" />
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-slate-900">
            {getSortOptions(t).map((option) => (
              <SortOption
                option={option}
                key={option.label}
                sortBy={surveyFilters.sortBy}
                handleSortChange={handleSortChange}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
