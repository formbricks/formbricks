"use client";

import { SortOption } from "@/app/(app)/environments/[environmentId]/surveys/components/SortOption";
import { initialFilters } from "@/app/(app)/environments/[environmentId]/surveys/components/SurveyList";
import { ChevronDownIcon, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useDebounce } from "react-use";
import { TProductConfigChannel } from "@formbricks/types/product";
import { TFilterOption, TSortOption, TSurveyFilters } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@formbricks/ui/components/DropdownMenu";
import { SearchBar } from "@formbricks/ui/components/SearchBar";
import { SurveyFilterDropdown } from "./SurveyFilterDropdown";

interface SurveyFilterProps {
  surveyFilters: TSurveyFilters;
  setSurveyFilters: React.Dispatch<React.SetStateAction<TSurveyFilters>>;
  currentProductChannel: TProductConfigChannel;
}

const creatorOptions: TFilterOption[] = [
  { label: "You", value: "you" },
  { label: "Others", value: "others" },
];

const statusOptions: TFilterOption[] = [
  { label: "In Progress", value: "inProgress" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Paused", value: "paused" },
  { label: "Completed", value: "completed" },
  { label: "Draft", value: "draft" },
];

const sortOptions: TSortOption[] = [
  {
    label: "Last Modified",
    value: "updatedAt",
  },
  {
    label: "Created On",
    value: "createdAt",
  },
  {
    label: "Alphabetical",
    value: "name",
  },
  {
    label: "Relevance",
    value: "relevance",
  },
];

export const SurveyFilters = ({
  surveyFilters,
  setSurveyFilters,
  currentProductChannel,
}: SurveyFilterProps) => {
  const { createdBy, sortBy, status, type } = surveyFilters;
  const [name, setName] = useState("");
  const t = useTranslations();
  useDebounce(() => setSurveyFilters((prev) => ({ ...prev, name: name })), 800, [name]);

  const [dropdownOpenStates, setDropdownOpenStates] = useState(new Map());

  const typeOptions: TFilterOption[] = [
    { label: "Link", value: "link" },
    { label: "App", value: "app" },
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
        {currentProductChannel !== "link" && (
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
            className="h-8"
            EndIcon={X}
            endIconClassName="h-4 w-4">
            {t("common.clear_filters")}
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
                  {t("common.sort_by")}: {sortOptions.find((option) => option.value === sortBy)?.label}
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
