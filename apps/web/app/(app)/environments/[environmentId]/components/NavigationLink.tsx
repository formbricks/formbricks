import { cn } from "@/lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import Link from "next/link";
import React from "react";

interface NavigationLinkProps {
  href: string;
  isActive: boolean;
  isCollapsed: boolean;
  children: React.ReactNode;
  linkText: string;
  isTextVisible: boolean;
}

export const NavigationLink = ({
  href,
  isActive,
  isCollapsed = false,
  children,
  linkText,
  isTextVisible = true,
}: NavigationLinkProps) => {
  // [UseTusk]

  const activeClass = "bg-slate-50 border-r-4 border-brand-dark font-semibold text-slate-900";
  const inactiveClass =
    "hover:bg-slate-50 border-r-4 border-transparent hover:border-slate-300 transition-all duration-150 ease-in-out";

  return (
    <>
      {isCollapsed ? (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <li
                className={cn(
                  "mb-1 ml-2 rounded-l-md py-2 pl-2 text-sm text-slate-700 hover:text-slate-900",
                  isActive ? activeClass : inactiveClass
                )}>
                <Link href={href} className="flex items-center">
                  {children}
                </Link>
              </li>
            </TooltipTrigger>
            <TooltipContent side="right">{linkText}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <li
          className={cn(
            "mb-1 rounded-l-md py-2 pl-5 text-sm text-slate-600 hover:text-slate-900",
            isActive ? activeClass : inactiveClass
          )}>
          <Link href={href} className="flex items-center">
            {children}
            <span
              className={cn(
                "ml-2 flex transition-opacity duration-100",
                isTextVisible ? "opacity-0" : "opacity-100"
              )}>
              {linkText}
            </span>
          </Link>
        </li>
      )}
    </>
  );
};
