"use client";

import { SortOption } from "@/app/(app)/environments/[environmentId]/surveys/components/SortOption";
import { initialFilters } from "@/app/(app)/environments/[environmentId]/surveys/components/SurveyList";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { SearchBar } from "@/modules/ui/components/search-bar";
import { ChevronDownIcon, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useDebounce } from "react-use";
import { TProjectConfigChannel } from "@formbricks/types/project";
import { TFilterOption, TSortOption, TSurveyFilters } from "@formbricks/types/surveys/types";
import { SurveyFilterDropdown } from "./SurveyFilterDropdown";

interface SurveyFilterProps {
  surveyFilters: TSurveyFilters;
  setSurveyFilters: React.Dispatch<React.SetStateAction<TSurveyFilters>>;
  currentProjectChannel: TProjectConfigChannel;
}

const creatorOptions: TFilterOption[] = [
  { label: "common.you", value: "you" },
  { label: "common.others", value: "others" },
];

const statusOptions: TFilterOption[] = [
  { label: "common.scheduled", value: "scheduled" },
  { label: "common.paused", value: "paused" },
  { label: "common.completed", value: "completed" },
  { label: "common.draft", value: "draft" },
];

const sortOptions: TSortOption[] = [
  {
    label: "common.updated_at",
    value: "updatedAt",
  },
  {
    label: "common.created_at",
    value: "createdAt",
  },
  {
    label: "environments.surveys.alphabetical",
    value: "name",
  },
  {
    label: "environments.surveys.relevance",
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
  const t = useTranslations();
  useDebounce(() => setSurveyFilters((prev) => ({ ...prev, name: name })), 800, [name]);

  const [dropdownOpenStates, setDropdownOpenStates] = useState(new Map());

  const typeOptions: TFilterOption[] = [
    { label: "common.link", value: "link" },
    { label: "common.app", value: "app" },
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
    if (
      value === "inProgress" ||
      value === "paused" ||
      value === "completed" ||
      value === "draft" ||
      value === "scheduled"
    ) {
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
            options={creatorOptions}
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
            options={statusOptions}
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

        {(createdBy.length > 0 || status.length > 0 || type.length > 0) && (
          <Button
            size="sm"
            onClick={() => {
              setSurveyFilters(initialFilters);
              localStorage.removeItem("surveyFilters");
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
                  {t("common.sort_by")}: {t(sortOptions.find((option) => option.value === sortBy)?.label)}
                </span>
                <ChevronDownIcon className="ml-2 h-4 w-4" />
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-slate-900">
            {sortOptions.map((option) => (
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
