import { ChevronDownIcon } from "lucide-react";
import React from "react";
import { cn } from "@formbricks/lib/cn";
import { TBadgeProps } from "@formbricks/types/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../DropdownMenu";

// Adjust the import path as necessary

export const Badge: React.FC<TBadgeProps> = ({
  text,
  type,
  options,
  selectedIndex = 0,
  onChange,
  size,
  className,
}) => {
  const bgColor = {
    warning: "bg-amber-100",
    success: "bg-emerald-100",
    error: "bg-red-100",
    gray: "bg-slate-100",
  };

  const borderColor = {
    warning: "border-amber-200",
    success: "border-emerald-200",
    error: "border-red-200",
    gray: "border-slate-200",
  };

  const textColor = {
    warning: "text-amber-800",
    success: "text-emerald-800",
    error: "text-red-800",
    gray: "text-slate-600",
  };

  const padding = {
    tiny: "px-1.5 py-0.5",
    normal: "px-2.5 py-0.5",
    large: "px-3.5 py-1",
  };

  const textSize = size === "large" ? "text-sm" : "text-xs";

  const currentOption = options ? options[selectedIndex] : { text, type: type || "gray" };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center rounded-full border border-opacity-50 font-medium",
            options ? "cursor-pointer hover:border-opacity-100" : "pointer-events-none",
            bgColor[currentOption.type],
            borderColor[currentOption.type],
            textColor[currentOption.type],
            padding[size],
            textSize,
            className
          )}>
          {currentOption.text}
          {options && <ChevronDownIcon className="ml-1 h-3 w-3" aria-hidden="true" />}
        </span>
      </DropdownMenuTrigger>
      {options && (
        <DropdownMenuContent className="mt-1 bg-white shadow-lg">
          {options.map((option, index) => (
            <DropdownMenuItem
              key={index}
              className={cn("cursor-pointer px-4 py-2 hover:bg-slate-100", textSize)}
              onClick={(event) => {
                event.stopPropagation();
                onChange && onChange(index);
              }}>
              {option.text}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
};
