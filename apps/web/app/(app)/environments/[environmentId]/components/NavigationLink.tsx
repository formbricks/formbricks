import Link from "next/link";
import React from "react";
import { cn } from "@/lib/cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface NavigationLinkProps {
  href: string;
  isActive: boolean;
  isCollapsed: boolean;
  children: React.ReactNode;
  linkText: string;
  isTextVisible: boolean;
  disabled?: boolean;
  disabledMessage?: string;
}

export const NavigationLink = ({
  href,
  isActive,
  isCollapsed = false,
  children,
  linkText,
  isTextVisible = true,
  disabled = false,
  disabledMessage,
}: NavigationLinkProps) => {
  const tooltipText = disabled ? disabledMessage || linkText : linkText;
  const activeClass = "bg-slate-50 border-r-4 border-brand-dark font-semibold text-slate-900";
  const inactiveClass =
    "hover:bg-slate-50 border-r-4 border-transparent hover:border-slate-300 transition-all duration-150 ease-in-out";
  const disabledClass = "cursor-not-allowed border-r-4 border-transparent text-slate-400";
  const getColorClass = (baseClass: string) => {
    if (disabled) {
      return disabledClass;
    }

    return cn(baseClass, isActive ? activeClass : inactiveClass);
  };

  const collapsedColorClass = getColorClass("text-slate-700 hover:text-slate-900");
  const expandedColorClass = getColorClass("text-slate-600 hover:text-slate-900");

  const label = (
    <span
      className={cn(
        "ml-2 flex transition-opacity duration-100",
        isTextVisible ? "opacity-0" : "opacity-100"
      )}>
      {linkText}
    </span>
  );

  return (
    <>
      {isCollapsed ? (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <li className={cn("mb-1 ml-2 rounded-l-md py-2 pl-2 text-sm", collapsedColorClass)}>
                {disabled ? (
                  <div className="flex items-center">{children}</div>
                ) : (
                  <Link href={href}>{children}</Link>
                )}
              </li>
            </TooltipTrigger>
            <TooltipContent side="right">{tooltipText}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <li className={cn("mb-1 rounded-l-md py-2 pl-5 text-sm", expandedColorClass)}>
          {disabled ? (
            <Popover>
              <PopoverTrigger asChild>
                <div className="flex items-center">
                  {children}
                  {label}
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-fit max-w-72 px-3 py-2 text-sm text-slate-700">
                {disabledMessage || linkText}
              </PopoverContent>
            </Popover>
          ) : (
            <Link href={href} className="flex items-center">
              {children}
              {label}
            </Link>
          )}
        </li>
      )}
    </>
  );
};
