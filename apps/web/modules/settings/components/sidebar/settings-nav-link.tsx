"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/modules/settings/components/sidebar/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface SettingsNavLinkProps {
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
  isTextVisible: boolean;
  disabledMessage?: string;
}

export const SettingsNavLink = ({
  item,
  isActive,
  isCollapsed,
  isTextVisible,
  disabledMessage,
}: Readonly<SettingsNavLinkProps>) => {
  const activeClass = "bg-slate-50 border-r-4 border-brand-dark font-semibold text-slate-900";
  const inactiveClass =
    "hover:bg-slate-50 border-r-4 border-transparent hover:border-slate-300 transition-all duration-150 ease-in-out";
  const disabledClass = "cursor-not-allowed border-r-4 border-transparent text-slate-400";

  const isDisabled = item.disabled;

  const getStateClass = () => {
    if (isDisabled) return disabledClass;
    return isActive ? activeClass : inactiveClass;
  };

  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <li className={cn("rounded-l-md py-1.5 pl-2 text-sm", getStateClass())}>
              {isDisabled ? (
                <div className="flex items-center">{item.icon}</div>
              ) : (
                <Link href={item.href} className="flex items-center text-slate-600 hover:text-slate-900">
                  {item.icon}
                </Link>
              )}
            </li>
          </TooltipTrigger>
          <TooltipContent side="right">
            {isDisabled ? disabledMessage || item.label : item.label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isDisabled) {
    return (
      <li className={cn("rounded-l-md py-1.5 pl-8 text-sm", disabledClass)}>
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex items-center">
              {item.icon}
              <span
                className={cn(
                  "ml-2 transition-opacity duration-100",
                  isTextVisible ? "opacity-0" : "opacity-100"
                )}>
                {item.label}
              </span>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-fit max-w-72 px-3 py-2 text-sm text-slate-700">
            {disabledMessage || item.label}
          </PopoverContent>
        </Popover>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "rounded-l-md py-1.5 pl-8 text-sm",
        isActive ? activeClass : inactiveClass,
        "text-slate-600 hover:text-slate-900"
      )}>
      <Link href={item.href} className="flex items-center">
        {item.icon}
        <span
          className={cn("ml-2 transition-opacity duration-100", isTextVisible ? "opacity-0" : "opacity-100")}>
          {item.label}
        </span>
      </Link>
    </li>
  );
};
