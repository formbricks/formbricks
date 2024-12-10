import { Label } from "@/modules/ui/components/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function LanguageLabels() {
  const t = useTranslations();
  return (
    <div className="mb-2 grid w-full grid-cols-4 gap-4">
      <Label htmlFor="languagesId">{t("environments.project.languages.language")}</Label>
      <Label htmlFor="languagesId">{t("environments.project.languages.identifier")}</Label>
      <Label className="flex items-center space-x-2" htmlFor="Alias">
        <span>{t("environments.project.languages.alias")}</span> <AliasTooltip t={t} />
      </Label>
    </div>
  );
}

function AliasTooltip({ t }: { t: (key: string) => string }) {
  return (
    <TooltipProvider delayDuration={80}>
      <Tooltip>
        <TooltipTrigger tabIndex={-1}>
          <div>
            <InfoIcon className="h-4 w-4 text-slate-400" />
          </div>
        </TooltipTrigger>
        <TooltipContent>{t("environments.project.languages.alias_tooltip")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
