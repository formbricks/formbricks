import { useMemo } from "react";
import { cn } from "@formbricks/lib/cn";
import { TProductIndustry } from "@formbricks/types/product";
import { TSurveyType } from "@formbricks/types/surveys";
import { TTemplateRole } from "@formbricks/types/templates";
import { channelMapping, industryMapping, roleMapping } from "../lib/utils";

interface TemplateTagsProps {
  channels?: TSurveyType[];
  industries?: TProductIndustry[];
  role?: TTemplateRole;
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
  const getLabel = (channelValue: TSurveyType) =>
    channelMapping.find((channel) => channel.value === channelValue)?.label;
  const labels = channels.map((channel) => getLabel(channel)).sort();

  switch (channels.length) {
    case 1:
      return labels[0];

    case 2:
      // Return labels for two channels concatenated with "or"
      return `${labels[0]} or ${labels[1]}`;

    case 3:
      // Return labels for three channels, formatted with commas and "or"
      return `${labels[0]}, ${labels[1]} or ${labels[2]}`;

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

export const TemplateTags = ({ channels, industries, role }: TemplateTagsProps) => {
  const roleBasedStyling = useMemo(() => getRoleBasedStyling(role), [role]);

  const roleTag = useMemo(() => roleMapping.find((roleMap) => roleMap.value === role)?.label, [role]);

  const channelTag = useMemo(() => getChannelTag(channels), [channels]);

  const industryTag = useMemo(() => getIndustryTag(industries), [industries]);

  return (
    <div className="flex space-x-2">
      <div className={cn("rounded border px-1.5 py-0.5 text-xs", roleBasedStyling)}>{roleTag}</div>
      {channelTag && (
        <div
          className={cn("rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500")}>
          {channelTag}
        </div>
      )}
      {industryTag && (
        <div
          className={cn("rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500")}>
          {industryTag}
        </div>
      )}
    </div>
  );
};
