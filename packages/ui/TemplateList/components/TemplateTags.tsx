import { SplitIcon } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@formbricks/lib/cn";
import { TProductIndustry } from "@formbricks/types/product";
import { TSurveyType } from "@formbricks/types/surveys";
import { TTemplate, TTemplateRole } from "@formbricks/types/templates";
import { TooltipRenderer } from "../../Tooltip";
import { channelMapping, industryMapping, roleMapping } from "../lib/utils";

interface TemplateTagsProps {
  template: TTemplate;
}

const getRoleBasedStyling = (role: TTemplateRole | undefined): string => {
  switch (role) {
    case "productManager":
      return "border-blue-300 bg-blue-50 text-blue-500";
    case "marketing":
      return "border-orange-300 bg-orange-50 text-orange-500";
    case "sales":
      return "border-emerald-300 bg-emerald-50 text-emerald-500";
    case "customerSuccess":
      return "border-violet-300 bg-violet-50 text-violet-500";
    default:
      return "border-slate-300 bg-slate-50 text-slate-500";
  }
};

const getChannelTag = (channels: TSurveyType[] | undefined): string | undefined => {
  if (!channels) return undefined;
  switch (channels.length) {
    case 1:
      return channelMapping.find((channel) => channel.value === channels[0])?.label;
    case 2:
      return "Two Channels";
    case 3:
      return "Three Channels";
    case 4:
      return "All Channels";
    default:
      return undefined;
  }
};

const getIndustryTag = (industries: TProductIndustry[] | undefined): string | undefined => {
  if (!industries || industries.length === 0) return undefined;
  return industries.length > 1
    ? "Multiple Industries"
    : industryMapping.find((industry) => industry.value === industries[0])?.label;
};

export const TemplateTags = ({ template }: TemplateTagsProps) => {
  const roleBasedStyling = useMemo(() => getRoleBasedStyling(template.role), [template.role]);

  const roleTag = useMemo(
    () => roleMapping.find((roleMap) => roleMap.value === template.role)?.label,
    [template.role]
  );

  const channelTag = useMemo(() => getChannelTag(template.channels), [template.channels]);

  const industryTag = useMemo(() => getIndustryTag(template.industries), [template.industries]);

  return (
    <div className="flex flex-wrap gap-1.5">
      <div className={cn("rounded border px-1.5 py-0.5 text-xs", roleBasedStyling)}>{roleTag}</div>
      {channelTag && (
        <div
          className={cn(
            "flex-nowrap rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500"
          )}>
          {channelTag}
        </div>
      )}
      {industryTag && (
        <div
          className={cn("rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500")}>
          {industryTag}
        </div>
      )}
      {template.preset.questions.some((question) => question.logic && question.logic.length > 0) && (
        <TooltipRenderer tooltipContent="This survey uses branching logic." shouldRender={true}>
          <SplitIcon className="h-5 w-5 rounded border border-slate-300 bg-slate-50 p-0.5 text-slate-400" />
        </TooltipRenderer>
      )}
    </div>
  );
};
