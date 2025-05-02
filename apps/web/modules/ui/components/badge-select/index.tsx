import { cn } from "@/lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
import React from "react";
import { z } from "zod";

const ZBadgeSelectOptionSchema = z.object({
  text: z.string(),
  type: z.enum(["warning", "success", "error", "gray"]),
});

const ZBadgeSelectPropsSchema = z.object({
  text: z.string().optional(),
  type: z.enum(["warning", "success", "error", "gray"]).optional(),
  options: z.array(ZBadgeSelectOptionSchema).optional(),
  selectedIndex: z.number().optional(),
  onChange: z.function().args(z.number()).returns(z.void()).optional(),
  size: z.enum(["tiny", "normal", "large"]),
  className: z.string().optional(),
  isLoading: z.boolean().optional(),
});

export type TBadgeSelectOption = z.infer<typeof ZBadgeSelectOptionSchema>;
export type TBadgeSelectProps = z.infer<typeof ZBadgeSelectPropsSchema>;

export const BadgeSelect: React.FC<TBadgeSelectProps & { isLoading?: boolean }> = ({
  text,
  type,
  options,
  selectedIndex = 0,
  onChange,
  size,
  className,
  isLoading = false,
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

  const renderContent = () => {
    if (isLoading) {
      return (
        <span className="animate-pulse" aria-busy="true">
          <span className={cn("inline-block h-2 w-8 rounded-full bg-black/10")}></span>
        </span>
      );
    }
    return (
      <>
        {currentOption.text}
        {options && <ChevronDownIcon className="ml-1 h-3 w-3" aria-hidden="true" />}
      </>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span
          className={cn(
            "border-opacity-50 inline-flex items-center rounded-full border font-medium",
            options && !isLoading ? "hover:border-opacity-100 cursor-pointer" : "pointer-events-none",
            bgColor[currentOption.type],
            borderColor[currentOption.type],
            textColor[currentOption.type],
            padding[size],
            textSize,
            className
          )}>
          {renderContent()}
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
                onChange?.(index);
              }}>
              {option.text}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
};
