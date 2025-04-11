"use client";

import { Checkbox } from "@/modules/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { useTranslate } from "@tolgee/react";
import { ChevronDownIcon } from "lucide-react";
import { TFilterOption } from "@formbricks/types/surveys/types";

interface SurveyFilterDropdownProps {
  title: string;
  id: "createdBy" | "status" | "type";
  options: TFilterOption[];
  selectedOptions: string[];
  setSelectedOptions: (value: string) => void;
  isOpen: boolean;
  toggleDropdown: (id: string) => void;
}

export const SurveyFilterDropdown = ({
  title,
  id,
  options,
  selectedOptions,
  setSelectedOptions,
  isOpen,
  toggleDropdown,
}: SurveyFilterDropdownProps) => {
  const { t } = useTranslate();
  const triggerClasses = `surveyFilterDropdown min-w-auto h-8 rounded-md border border-slate-700 sm:px-2 cursor-pointer outline-hidden 
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
              setSelectedOptions(option.value);
            }}>
            <div className="flex h-full w-full items-center space-x-2 px-2 py-1 hover:bg-slate-700">
              <Checkbox
                checked={selectedOptions.includes(option.value)}
                className={`bg-white ${selectedOptions.includes(option.value) ? "bg-brand-dark border-none" : ""}`}
              />
              <p className="font-normal text-white">{t(option.label)}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
