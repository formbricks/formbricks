import { cn } from "@formbricks/lib/cn";
import { TTemplate, TTemplateFilter } from "@formbricks/types/templates";
import { TemplateTags } from "./TemplateTags";

interface TemplateProps {
  template: TTemplate;
  activeTemplate: TTemplate | null;
  createSurvey: (template: TTemplate) => void;
  selectedFilter: TTemplateFilter[];
}

export const Template = ({ template, activeTemplate, createSurvey, selectedFilter }: TemplateProps) => {
  return (
    <div
      onClick={() => createSurvey(template)}
      key={template.name}
      className={cn(
        activeTemplate?.name === template.name && "ring-2 ring-slate-400",
        "duration-120 group relative cursor-pointer rounded-lg bg-white p-6 shadow transition-all duration-150 hover:ring-2 hover:ring-slate-300"
      )}>
      <TemplateTags template={template} selectedFilter={selectedFilter} />
      <h3 className="text-md mb-1 mt-3 text-left font-bold text-slate-700">{template.name}</h3>
      <p className="text-left text-xs text-slate-600">{template.description}</p>
    </div>
  );
};
