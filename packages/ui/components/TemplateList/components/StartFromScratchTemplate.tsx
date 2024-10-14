import { PlusCircleIcon } from "lucide-react";
import { customSurvey } from "@formbricks/lib/templates";
import { TProduct } from "@formbricks/types/product";
import { TTemplate } from "@formbricks/types/templates";
import { replacePresetPlaceholders } from "../lib/utils";

interface StartFromScratchTemplateProps {
  setActiveTemplate: (template: TTemplate) => void;
  onTemplateClick: (template: TTemplate) => void;
  product: TProduct;
  createSurvey: (template: TTemplate) => void;
}

export const StartFromScratchTemplate = ({
  setActiveTemplate,
  onTemplateClick,
  product,
  createSurvey,
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
      className="hover:border-brand-dark duration-120 group relative rounded-lg border-2 border-dashed border-slate-300 bg-transparent p-6 transition-colors duration-150">
      <PlusCircleIcon className="text-brand-dark h-8 w-8 transition-all duration-150 group-hover:scale-110" />
      <h3 className="text-md mb-1 mt-3 text-left font-bold text-slate-700">{customSurvey.name}</h3>
      <p className="text-left text-xs text-slate-600">{customSurvey.description}</p>
    </button>
  );
};
