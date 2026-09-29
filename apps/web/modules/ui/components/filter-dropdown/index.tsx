"use client";

import { ChevronDownIcon } from "lucide-react";
import { Fragment } from "react";
import { Checkbox } from "@/modules/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

export interface TFilterOption<TValue extends string = string> {
  label: string;
  value: TValue;
  /** Render a divider above this option, to set it apart from the ones before it. */
  separatorBefore?: boolean;
}

interface FilterDropdownProps<TValue extends string> {
  title: string;
  options: TFilterOption<TValue>[];
  selectedOptions: readonly TValue[];
  onToggleOption: (value: TValue) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Extra class on the trigger, used by list pages to scope their own styling/selectors. */
  className?: string;
}

/** Multi-select checkbox filter used by the surveys and workflows list toolbars. */
export const FilterDropdown = <TValue extends string>({
  title,
  options,
  selectedOptions,
  onToggleOption,
  isOpen,
  onOpenChange,
  className = "",
}: Readonly<FilterDropdownProps<TValue>>) => {
  const triggerClasses = `${className} min-w-auto h-8 rounded-md border border-slate-700 sm:px-2 cursor-pointer outline-hidden
    ${selectedOptions.length > 0 ? "bg-slate-900 text-white" : "hover:bg-slate-900 hover:text-white"}`;

  return (
    <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild className={triggerClasses}>
        <button type="button" className="flex items-center" aria-label={title}>
          <span className="text-sm">{title}</span>
          <ChevronDownIcon className="ml-2 size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-slate-900">
        {options.map((option) => (
          <Fragment key={option.value}>
            {option.separatorBefore ? <DropdownMenuSeparator className="bg-slate-700" /> : null}
            <DropdownMenuItem
              className="m-0 p-0"
              onClick={(e) => {
                e.preventDefault();
                onToggleOption(option.value);
              }}>
              <div className="flex h-full w-full items-center gap-x-2 px-2 py-1 hover:bg-slate-700">
                <Checkbox
                  checked={selectedOptions.includes(option.value)}
                  className={`bg-white ${selectedOptions.includes(option.value) ? "border-none bg-brand-dark" : ""}`}
                />
                <p className="font-normal text-white">{option.label}</p>
              </div>
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
