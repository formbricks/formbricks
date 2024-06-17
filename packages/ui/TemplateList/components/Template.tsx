import { SplitIcon } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@formbricks/lib/cn";
import { TProduct, TProductIndustry } from "@formbricks/types/product";
import { TSurveyType } from "@formbricks/types/surveys";
import { TTemplate, TTemplateRole } from "@formbricks/types/templates";
import { Button } from "../../Button";
import { TooltipRenderer } from "../../Tooltip";
import { replacePresetPlaceholders } from "../lib/utils";

interface TemplateProps {
  template: TTemplate;
  activeTemplate: TTemplate | null;
  setActiveTemplate: (template: TTemplate) => void;
  onTemplateClick?: (template: TTemplate) => void;
  product: TProduct;
  createSurvey: (template: TTemplate) => void;
  loading: boolean;
  channelMapping: { value: TSurveyType; label: string }[];
  industryMapping: { value: TProductIndustry; label: string }[];
  roleMapping: { value: TTemplateRole; label: string }[];
}

export const Template = ({
  template,
  activeTemplate,
  setActiveTemplate,
  onTemplateClick = () => {},
  product,
  createSurvey,
  loading,
}: TemplateProps) => {
  const roleBasedStyling = useMemo(() => {
    switch (template.role) {
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
  }, [template.role]);
  return (
    <div
      onClick={() => {
        const newTemplate = replacePresetPlaceholders(template, product);
        onTemplateClick(newTemplate);
        setActiveTemplate(newTemplate);
      }}
      key={template.name}
      className={cn(
        activeTemplate?.name === template.name && "ring-2 ring-slate-400",
        "duration-120 group relative cursor-pointer rounded-lg bg-white p-6 shadow transition-all duration-150 hover:ring-2 hover:ring-slate-300"
      )}>
      <div className="flex">
        <div className={cn("rounded border px-1.5 py-0.5 text-xs", roleBasedStyling)}>{template.role}</div>
        {template.preset.questions.some((question) => question.logic && question.logic.length > 0) && (
          <TooltipRenderer tooltipContent="This survey uses branching logic." shouldRender={true}>
            <SplitIcon className="ml-1.5 h-5 w-5 rounded border border-slate-300 bg-slate-50 p-0.5 text-slate-400" />
          </TooltipRenderer>
        )}
      </div>
      <h3 className="text-md mb-1 mt-3 text-left font-bold text-slate-700">{template.name}</h3>
      <p className="text-left text-xs text-slate-600">{template.description}</p>
      {activeTemplate?.name === template.name && (
        <div className="flex justify-start">
          <Button
            variant="darkCTA"
            className="mt-6 px-6 py-3"
            disabled={activeTemplate === null}
            loading={loading}
            onClick={() => createSurvey(activeTemplate)}>
            Use this template
          </Button>
        </div>
      )}
    </div>
  );
};
