"use client";

import { ChevronDownIcon, CircleHelpIcon, Code2Icon, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BreadcrumbItem } from "@/modules/ui/components/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

export const EnvironmentBreadcrumb = ({
  environments,
  currentEnvironment,
}: {
  environments: { id: string; type: string }[];
  currentEnvironment: { id: string; type: string };
}) => {
  const { t } = useTranslation();
  const [isEnvironmentDropdownOpen, setIsEnvironmentDropdownOpen] = useState(false);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleEnvironmentChange = (environmentId: string) => {
    if (environmentId === currentEnvironment.id) return;
    setIsLoading(true);
    router.push(`/environments/${environmentId}/`);
  };

  const developmentTooltip = () => {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <CircleHelpIcon className="h-3 w-3" />
          </TooltipTrigger>
          <TooltipContent className="mt-2 border-none bg-red-800 text-white">
            {t("common.development_environment_banner")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <BreadcrumbItem
      isActive={isEnvironmentDropdownOpen}
      isHighlighted={currentEnvironment.type === "development"}>
      <DropdownMenu onOpenChange={setIsEnvironmentDropdownOpen}>
        <DropdownMenuTrigger
          className="flex cursor-pointer items-center gap-1 outline-none"
          id="environmentDropdownTrigger"
          asChild>
          <div className="flex items-center gap-1">
            <Code2Icon className="h-3 w-3" strokeWidth={1.5} />
            <span className="capitalize">{currentEnvironment.type}</span>
            {isLoading && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />}
            {currentEnvironment.type === "development" && developmentTooltip()}
            {isEnvironmentDropdownOpen && <ChevronDownIcon className="h-3 w-3" strokeWidth={1.5} />}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="mt-2" align="start">
          <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
            <Code2Icon className="mr-2 inline h-4 w-4" />
            {t("common.choose_environment")}
          </div>
          <DropdownMenuGroup>
            {environments.map((env) => (
              <DropdownMenuCheckboxItem
                key={env.id}
                checked={env.type === currentEnvironment.type}
                onClick={() => handleEnvironmentChange(env.id)}
                className="cursor-pointer">
                <div className="flex items-center gap-2 capitalize">
                  <span>{env.type}</span>
                </div>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </BreadcrumbItem>
  );
};
