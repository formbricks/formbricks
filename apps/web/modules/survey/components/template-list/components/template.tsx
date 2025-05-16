"use client";

import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { Project } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { TTemplate, TTemplateFilter } from "@formbricks/types/templates";
import { replacePresetPlaceholders } from "../lib/utils";
import { TemplateTags } from "./template-tags";

interface TemplateProps {
  template: TTemplate;
  activeTemplate: TTemplate | null;
  setActiveTemplate: (template: TTemplate) => void;
  onTemplateClick?: (template: TTemplate) => void;
  project: Project;
  createSurvey: (template: TTemplate) => void;
  loading: boolean;
  selectedFilter: TTemplateFilter[];
  noPreview?: boolean;
}

export const Template = ({
  template,
  activeTemplate,
  setActiveTemplate,
  onTemplateClick = () => {},
  project,
  createSurvey,
  loading,
  selectedFilter,
  noPreview,
}: TemplateProps) => {
  const { t } = useTranslate();

  const showCreateSurveyButton = activeTemplate?.name === template.name;

  const handleCardClick = () => {
    const newTemplate = replacePresetPlaceholders(template, project);
    if (noPreview) {
      createSurvey(newTemplate);
      return;
    }
    onTemplateClick(newTemplate);
    setActiveTemplate(newTemplate);
  };

  const cardClass = cn(
    showCreateSurveyButton && "ring-2 ring-slate-400",
    "flex flex-col group relative cursor-pointer rounded-lg bg-white p-6 shadow transition-all duration-120 duration-150 hover:ring-2 hover:ring-slate-300"
  );

  const cardContent = (
    <>
      <TemplateTags template={template} selectedFilter={selectedFilter} />
      <h3 className="text-md mb-1 mt-3 text-left font-bold text-slate-700">{template.name}</h3>
      <p className="text-left text-xs text-slate-600">{template.description}</p>
      {showCreateSurveyButton && (
        <div className="flex justify-start">
          <Button
            className="mt-6 px-6 py-3"
            disabled={activeTemplate === null}
            loading={loading}
            onClick={() => createSurvey(activeTemplate)}>
            {t("environments.surveys.templates.use_this_template")}
          </Button>
        </div>
      )}
    </>
  );

  if (showCreateSurveyButton) {
    return <div className={cardClass}>{cardContent}</div>;
  }

  return (
    <button type="button" className={cardClass} onClick={handleCardClick} key={template.name}>
      {cardContent}
    </button>
  );
};
