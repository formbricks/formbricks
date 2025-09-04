import { BreadcrumbItem } from "@/modules/ui/components/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { ChevronDownIcon, CircleHelpIcon, Code2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";

export const EnvironmentBreadcrumb = ({
  environments,
  environment,
}: {
  environments: TEnvironment[];
  environment: TEnvironment;
}) => {
  const { t } = useTranslate();
  const [environmentDropdownOpen, setEnvironmentDropdownOpen] = useState(false);
  const router = useRouter();

  const handleEnvironmentChange = (environmentId: string) => {
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
    <BreadcrumbItem isActive={environmentDropdownOpen} isHighlighted={environment.type === "development"}>
      <DropdownMenu onOpenChange={setEnvironmentDropdownOpen}>
        <DropdownMenuTrigger className="flex items-center gap-1 outline-none">
          <Code2Icon className="h-3 w-3" strokeWidth={1.5} />
          <span className="capitalize">{environment.type}</span>
          {environment.type === "development" && developmentTooltip()}
          {environmentDropdownOpen && <ChevronDownIcon className="h-3 w-3" strokeWidth={1.5} />}
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
                checked={env.id === environment.id}
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
