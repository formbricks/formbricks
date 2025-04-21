"use client";

import { cn } from "@/lib/cn";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { TFnType } from "@tolgee/react";
import { SplitIcon } from "lucide-react";
import { useMemo } from "react";
import { TProjectConfigChannel, TProjectConfigIndustry } from "@formbricks/types/project";
import { TTemplate, TTemplateFilter, TTemplateRole } from "@formbricks/types/templates";
import { getChannelMapping, getIndustryMapping, getRoleMapping } from "../lib/utils";

interface TemplateTagsProps {
  template: TTemplate;
  selectedFilter: TTemplateFilter[];
}

type NonNullabeChannel = NonNullable<TProjectConfigChannel>;

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
    case "peopleManager":
      return "border-pink-300 bg-pink-50 text-pink-500";
    default:
      return "border-slate-300 bg-slate-50 text-slate-500";
  }
};

const getChannelTag = (channels: NonNullabeChannel[] | undefined, t: TFnType): string | undefined => {
  if (!channels) return undefined;
  const getLabel = (channelValue: NonNullabeChannel) =>
    getChannelMapping(t).find((channel) => channel.value === channelValue)?.label;
  const labels = channels
    .map((channel) => {
      const label = getLabel(channel);
      if (label) return t(label);
      return undefined;
    })
    .sort();

  const removeSurveySuffix = (label: string | undefined) => label?.replace(" Survey", "");

  switch (channels.length) {
    case 1:
      return labels[0];

    case 2:
      // Return labels for two channels concatenated with "or", removing "Survey"
      return labels.map(removeSurveySuffix).join(" " + t("common.or") + " ");

    case 3:
      return t("environments.surveys.templates.all_channels");

    default:
      return undefined;
  }
};

export const TemplateTags = ({ template, selectedFilter }: TemplateTagsProps) => {
  const { t } = useTranslate();
  const roleBasedStyling = useMemo(() => getRoleBasedStyling(template.role), [template.role]);

  const roleTag = useMemo(
    () => getRoleMapping(t).find((roleMap) => roleMap.value === template.role)?.label,
    [template.role]
  );

  const channelTag = useMemo(() => getChannelTag(template.channels, t), [template.channels]);
  const getIndustryTag = (industries: TProjectConfigIndustry[] | undefined): string | undefined => {
    // if user selects an industry e.g. eCommerce than the tag should not say "Multiple industries" anymore but "E-Commerce".
    if (selectedFilter[1] !== null) {
      const industry = getIndustryMapping(t).find((industry) => industry.value === selectedFilter[1]);
      if (industry) return t(industry.label);
    }
    if (!industries || industries.length === 0) return undefined;
    return industries.length > 1
      ? t("environments.surveys.templates.multiple_industries")
      : t(getIndustryMapping(t).find((industry) => industry.value === industries[0])?.label ?? "");
  };

  const industryTag = useMemo(
    () => getIndustryTag(template.industries),
    [template.industries, selectedFilter]
  );

  return (
    <div className="flex flex-wrap gap-1.5">
      <div className={cn("rounded border px-1.5 py-0.5 text-xs", roleBasedStyling)}>{t(roleTag ?? "")}</div>
      {industryTag && (
        <div
          className={cn("rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500")}>
          {industryTag}
        </div>
      )}
      {channelTag && (
        <div
          className={cn(
            "flex-nowrap rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500"
          )}>
          {channelTag}
        </div>
      )}
      {template.preset.questions.some((question) => question.logic && question.logic.length > 0) && (
        <TooltipRenderer
          tooltipContent={t("environments.surveys.templates.uses_branching_logic")}
          shouldRender={true}>
          <SplitIcon className="h-5 w-5 rounded border border-slate-300 bg-slate-50 p-0.5 text-slate-400" />
        </TooltipRenderer>
      )}
    </div>
  );
};
