"use client";

import { TFunction } from "i18next";
import { ChevronDownIcon, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "react-use";
import { TProjectConfigChannel } from "@formbricks/types/project";
import { TFilterOption, TSortOption, TSurveyFilters } from "@formbricks/types/surveys/types";
import { FORMBRICKS_SURVEYS_FILTERS_KEY_LS } from "@/lib/localStorage";
import { SortOption } from "@/modules/survey/list/components/sort-option";
import { initialFilters } from "@/modules/survey/list/lib/constants";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { SearchBar } from "@/modules/ui/components/search-bar";
import { SurveyFilterDropdown } from "./survey-filter-dropdown";

interface SurveyFilterProps {
  surveyFilters: TSurveyFilters;
  setSurveyFilters: React.Dispatch<React.SetStateAction<TSurveyFilters>>;
  currentProjectChannel: TProjectConfigChannel;
}

const getCreatorOptions = (t: TFunction): TFilterOption[] => [
  { label: t("common.you"), value: "you" },
  { label: t("common.others"), value: "others" },
];

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
  const { createdBy, sortBy, status, type } = surveyFilters;
  const [name, setName] = useState("");
  const { t } = useTranslation();
  useDebounce(() => setSurveyFilters((prev) => ({ ...prev, name: name })), 800, [name]);

  const [dropdownOpenStates, setDropdownOpenStates] = useState(new Map());

  const typeOptions: TFilterOption[] = [
    { label: t("common.link"), value: "link" },
    { label: t("common.app"), value: "app" },
  ];

  const toggleDropdown = (id: string) => {
    setDropdownOpenStates(new Map(dropdownOpenStates).set(id, !dropdownOpenStates.get(id)));
  };

  const handleCreatedByChange = (value: string) => {
    if (value === "you" || value === "others") {
      if (createdBy.includes(value)) {
        setSurveyFilters((prev) => ({ ...prev, createdBy: prev.createdBy.filter((v) => v !== value) }));
      } else {
        setSurveyFilters((prev) => ({ ...prev, createdBy: [...prev.createdBy, value] }));
      }
    }
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
            title={t("common.created_by")}
            id="createdBy"
            options={getCreatorOptions(t)}
            selectedOptions={createdBy}
            setSelectedOptions={handleCreatedByChange}
            isOpen={dropdownOpenStates.get("createdBy")}
            toggleDropdown={toggleDropdown}
          />
        </div>
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

        {(createdBy.length > 0 || status.length > 0 || type.length > 0 || name) && (
          <Button
            size="sm"
            onClick={() => {
              setSurveyFilters(initialFilters);
              setName(""); // Also clear the search input
              localStorage.removeItem(FORMBRICKS_SURVEYS_FILTERS_KEY_LS);
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
