import { InfoIcon } from "lucide-react";
import { Label } from "@formbricks/ui/components/Label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/components/Tooltip";

export function LanguageLabels() {
  return (
    <div className="mb-2 grid w-full grid-cols-4 gap-4">
      <Label htmlFor="languagesId">Language</Label>
      <Label htmlFor="languagesId">Identifier (ISO)</Label>
      <Label className="flex items-center space-x-2" htmlFor="Alias">
        <span>Alias</span> <AliasTooltip />
      </Label>
    </div>
  );
}

function AliasTooltip() {
  return (
    <TooltipProvider delayDuration={80}>
      <Tooltip>
        <TooltipTrigger tabIndex={-1}>
          <div>
            <InfoIcon className="h-4 w-4 text-slate-400" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          The alias is an alternate name to identify the language in link surveys and the SDK (optional)
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
