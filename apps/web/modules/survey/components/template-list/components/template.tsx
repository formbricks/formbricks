"use client";

import { useTranslation } from "react-i18next";
import { Workspace } from "@formbricks/database/prisma-browser";
import { TTemplate, TTemplateFilter } from "@formbricks/types/templates";
import { cn } from "@/lib/cn";
import { replacePresetPlaceholders } from "@/lib/utils/templates";
import { Button } from "@/modules/ui/components/button";
import { TemplateTags } from "./template-tags";

interface TemplateProps {
  template: TTemplate;
  activeTemplate: TTemplate | null;
  setActiveTemplate: (template: TTemplate) => void;
  onTemplateClick?: (template: TTemplate) => void;
  workspace: Workspace;
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
  workspace,
  createSurvey,
  loading,
  selectedFilter,
  noPreview,
}: Readonly<TemplateProps>) => {
  const { t } = useTranslation();

  const showCreateSurveyButton = activeTemplate?.id === template.id;

  const handleCardClick = () => {
    const newTemplate = replacePresetPlaceholders(template, workspace);
    if (noPreview) {
      createSurvey(newTemplate);
      return;
    }
    onTemplateClick(newTemplate);
    setActiveTemplate(newTemplate);
  };

  const cardClass = cn(
    showCreateSurveyButton && "ring-2 ring-slate-400",
    "flex flex-col group relative cursor-pointer rounded-lg bg-white p-6 shadow-sm transition-all duration-120 duration-150 hover:ring-2 hover:ring-slate-300"
  );

  const cardContent = (
    <>
      <TemplateTags template={template} selectedFilter={selectedFilter} />
      <h3 className="text-md mt-3 mb-1 text-left font-bold text-slate-700">{template.name}</h3>
      <p className="text-left text-xs text-slate-600">{template.description}</p>
      {showCreateSurveyButton && (
        <div className="flex justify-start">
          <Button
            className="mt-6 max-w-full px-6 py-3"
            disabled={activeTemplate === null}
            loading={loading}
            aria-label={t("workspace.surveys.templates.use_this_template")}
            onClick={() => createSurvey(activeTemplate)}>
            <span className="truncate">{t("workspace.surveys.templates.use_this_template")}</span>
          </Button>
        </div>
      )}
    </>
  );

  if (showCreateSurveyButton) {
    return <div className={cardClass}>{cardContent}</div>;
  }

  return (
    <button type="button" className={cardClass} onClick={handleCardClick}>
      {cardContent}
    </button>
  );
};
