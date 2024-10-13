import { PlusCircleIcon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import { customSurvey } from "@formbricks/lib/templates";
import { TProduct } from "@formbricks/types/product";
import { TTemplate } from "@formbricks/types/templates";
import { Button } from "../../Button";
import { replacePresetPlaceholders } from "../lib/utils";

interface StartFromScratchTemplateProps {
  activeTemplate: TTemplate | null;
  setActiveTemplate: (template: TTemplate) => void;
  onTemplateClick: (template: TTemplate) => void;
  product: TProduct;
  createSurvey: (template: TTemplate) => void;
  loading: boolean;
}

export const StartFromScratchTemplate = ({
  activeTemplate,
  setActiveTemplate,
  onTemplateClick,
  product,
  createSurvey,
  loading,
}: StartFromScratchTemplateProps) => {
  const generateTemplateAndCreateSurvey = async () => {
    const newTemplate = replacePresetPlaceholders(customSurvey, product);
    onTemplateClick(newTemplate);
    setActiveTemplate(newTemplate);
    createSurvey(newTemplate);
  };
  return (
    <button
      type="button"
      onClick={generateTemplateAndCreateSurvey}
      className={cn(
        activeTemplate?.name === customSurvey.name
          ? "ring-brand-dark border-transparent ring-2"
          : "hover:border-brand-dark border-dashed border-slate-300",
        "duration-120 group relative rounded-lg border-2 bg-transparent p-6 transition-colors duration-150"
      )}>
      <PlusCircleIcon className="text-brand-dark h-8 w-8 transition-all duration-150 group-hover:scale-110" />
      <h3 className="text-md mb-1 mt-3 text-left font-bold text-slate-700">{customSurvey.name}</h3>
      <p className="text-left text-xs text-slate-600">{customSurvey.description}</p>
    </button>
  );
};
