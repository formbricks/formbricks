import { SplitIcon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import { TProduct } from "@formbricks/types/product";
import { TTemplate } from "@formbricks/types/templates";
import { Button } from "../../Button";
import { TooltipRenderer } from "../../Tooltip";
import { replacePresetPlaceholders } from "../lib/utils";
import { TemplateTags } from "./TemplateTags";

interface TemplateProps {
  template: TTemplate;
  activeTemplate: TTemplate | null;
  setActiveTemplate: (template: TTemplate) => void;
  onTemplateClick?: (template: TTemplate) => void;
  product: TProduct;
  createSurvey: (template: TTemplate) => void;
  loading: boolean;
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
        <TemplateTags role={template.role} channels={template.channels} industries={template.industries} />
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
