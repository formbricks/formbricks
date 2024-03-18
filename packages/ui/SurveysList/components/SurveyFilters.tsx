import { ChevronDownIcon, Equal, Grid2X2, Search, X } from "lucide-react";
import { useState } from "react";
import { useDebounce } from "react-use";

import { TSurveyFilters } from "@formbricks/types/surveys";

import { initialFilters } from "..";
import { Button } from "../../Button";
import { Checkbox } from "../../Checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../DropdownMenu";
import { TooltipRenderer } from "../../Tooltip";

interface SurveyFilterProps {
  orientation: string;
  setOrientation: (orientation: string) => void;
  surveyFilters: TSurveyFilters;
  setSurveyFilters: React.Dispatch<React.SetStateAction<TSurveyFilters>>;
}
interface TFilterOption {
  label: string;
  value: string;
}
interface TSortOption {
  label: string;
  value: "createdAt" | "updatedAt" | "name";
}

const creatorOptions: TFilterOption[] = [
  { label: "You", value: "you" },
  { label: "Others", value: "others" },
];

const statusOptions: TFilterOption[] = [
  { label: "In Progress", value: "inProgress" },
  { label: "Paused", value: "paused" },
  { label: "Completed", value: "completed" },
  { label: "Draft", value: "draft" },
];
const typeOptions: TFilterOption[] = [
  { label: "Link", value: "link" },
  { label: "In-app", value: "web" },
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
  // Add other sorting options as needed
];

const getToolTipContent = (orientation: string) => {
  return <div>{orientation} View</div>;
};

export default function SurveyFilters({
  orientation,
  setOrientation,
  surveyFilters,
  setSurveyFilters,
}: SurveyFilterProps) {
  const { createdBy, sortBy, status, type } = surveyFilters;
  const [name, setName] = useState("");

  useDebounce(() => setSurveyFilters((prev) => ({ ...prev, name: name })), 300, [name]);

  const [dropdownOpenStates, setDropdownOpenStates] = useState(new Map());

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
    if (value === "link" || value === "web") {
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
        <div className="flex h-8 items-center rounded-lg border border-slate-300 bg-white px-4">
          <Search className="h-4 w-4" />
          <input
            type="text"
            className="border-none bg-transparent placeholder:text-sm"
            placeholder="Search by survey name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <FilterDropdown
            title="Created By"
            id="createdBy"
            options={creatorOptions}
            selectedOptions={createdBy}
            setSelectedOptions={handleCreatedByChange}
            isOpen={dropdownOpenStates.get("createdBy")}
            toggleDropdown={toggleDropdown}
          />
        </div>
        <div>
          <FilterDropdown
            title="Status"
            id="status"
            options={statusOptions}
            selectedOptions={status}
            setSelectedOptions={handleStatusChange}
            isOpen={dropdownOpenStates.get("status")}
            toggleDropdown={toggleDropdown}
          />
        </div>
        <div>
          <FilterDropdown
            title="Type"
            id="type"
            options={typeOptions}
            selectedOptions={type}
            setSelectedOptions={handleTypeChange}
            isOpen={dropdownOpenStates.get("type")}
            toggleDropdown={toggleDropdown}
          />
        </div>

        {(createdBy.length > 0 || status.length > 0 || type.length > 0) && (
          <Button
            variant="darkCTA"
            size="sm"
            onClick={() => {
              setSurveyFilters(initialFilters);
            }}
            className="h-8"
            EndIcon={X}
            endIconClassName="h-4 w-4">
            Clear Filters
          </Button>
        )}
      </div>
      <div className="flex space-x-2">
        <TooltipRenderer
          shouldRender={true}
          tooltipContent={getToolTipContent("List")}
          className="bg-slate-900 text-white">
          <div
            className={`flex  h-8 w-8  items-center justify-center  rounded-lg border  p-1 ${orientation === "list" ? "bg-slate-900 text-white" : "bg-white"}`}
            onClick={() => setOrientation("list")}>
            <Equal className="h-5 w-5" />
          </div>
        </TooltipRenderer>

        <TooltipRenderer
          shouldRender={true}
          tooltipContent={getToolTipContent("Grid")}
          className="bg-slate-900 text-white">
          <div
            className={`flex h-8 w-8  items-center justify-center rounded-lg border  p-1 ${orientation === "grid" ? "bg-slate-900 text-white" : "bg-white"}`}
            onClick={() => setOrientation("grid")}>
            <Grid2X2 className="h-5 w-5" />
          </div>
        </TooltipRenderer>

        <DropdownMenu>
          <DropdownMenuTrigger
            asChild
            className="surveyFilterDropdown h-full cursor-pointer border border-slate-700 outline-none hover:bg-slate-900">
            <div className="min-w-auto h-8 rounded-md border sm:flex sm:px-2">
              <div className="hidden w-full items-center justify-between hover:text-white sm:flex">
                <span className="text-sm ">
                  Sort by: {sortOptions.find((option) => option.value === sortBy)?.label}
                </span>
                <ChevronDownIcon className="ml-2 h-4 w-4" />
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-slate-900 ">
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
}

interface FilterDropdownProps {
  title: string;
  id: "createdBy" | "status" | "type";
  options: TFilterOption[];
  selectedOptions: string[];
  setSelectedOptions: (type: "createdBy" | "status" | "type", value: string) => void;
  isOpen: boolean;
  toggleDropdown: (id: string) => void;
}

const FilterDropdown = ({
  title,
  id,
  options,
  selectedOptions,
  setSelectedOptions,
  isOpen,
  toggleDropdown,
}: FilterDropdownProps) => {
  const triggerClasses = `surveyFilterDropdown min-w-auto h-8 rounded-md border border-slate-700 sm:px-2 cursor-pointer outline-none 
  ${selectedOptions.length > 0 ? "bg-slate-900 text-white" : "hover:bg-slate-900"}`;

  return (
    <DropdownMenu open={isOpen} onOpenChange={() => toggleDropdown(id)}>
      <DropdownMenuTrigger asChild className={triggerClasses}>
        <div className="flex w-full items-center justify-between">
          <span className="text-sm">{title}</span>
          <ChevronDownIcon className="ml-2 h-4 w-4" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-slate-900">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className="m-0 p-0"
            onClick={(e) => {
              e.preventDefault();
              setSelectedOptions(id, option.value);
            }}>
            <div className="flex h-full w-full items-center space-x-2 px-2 py-1 hover:bg-slate-700">
              <Checkbox
                checked={selectedOptions.includes(option.value)}
                className={`bg-white ${selectedOptions.includes(option.value) ? "bg-brand-dark border-none" : ""}`}
              />
              <p className="font-normal text-white">{option.label}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface SortOptionProps {
  option: TSortOption;
  sortBy: TSurveyFilters["sortBy"];
  handleSortChange: (option: TSortOption) => void;
}

const SortOption = ({ option, sortBy, handleSortChange }: SortOptionProps) => (
  <DropdownMenuItem
    key={option.label}
    className="m-0 p-0"
    onClick={() => {
      handleSortChange(option);
    }}>
    <div className="flex h-full w-full items-center space-x-2 px-2 py-1 hover:bg-slate-700">
      <span
        className={`h-4 w-4 rounded-full border ${sortBy === option.value ? "bg-brand-dark outline-brand-dark border-slate-900 outline" : "border-white"}`}></span>
      <p className="font-normal text-white">{option.label}</p>
    </div>
  </DropdownMenuItem>
);
