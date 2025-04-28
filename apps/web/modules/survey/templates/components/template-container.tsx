"use client";

import { customSurveyTemplate } from "@/app/lib/templates";
import { TemplateList } from "@/modules/survey/components/template-list";
import { MenuBar } from "@/modules/survey/templates/components/menu-bar";
import { PreviewSurvey } from "@/modules/ui/components/preview-survey";
import { SearchBar } from "@/modules/ui/components/search-bar";
import { Project } from "@prisma/client";
import { Environment } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { useState } from "react";
import type { TProjectConfigChannel, TProjectConfigIndustry } from "@formbricks/types/project";
import type { TTemplate, TTemplateRole } from "@formbricks/types/templates";
import { getMinimalSurvey } from "../lib/minimal-survey";

type TemplateContainerWithPreviewProps = {
  project: Project;
  environment: Pick<Environment, "id" | "appSetupCompleted">;
  userId: string;
  prefilledFilters: (TProjectConfigChannel | TProjectConfigIndustry | TTemplateRole | null)[];
};

export const TemplateContainerWithPreview = ({
  project,
  environment,
  userId,
  prefilledFilters,
}: TemplateContainerWithPreviewProps) => {
  const { t } = useTranslate();
  const initialTemplate = customSurveyTemplate(t);
  const [activeTemplate, setActiveTemplate] = useState<TTemplate>(initialTemplate);
  const [activeQuestionId, setActiveQuestionId] = useState<string>(initialTemplate.preset.questions[0].id);
  const [templateSearch, setTemplateSearch] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <MenuBar />
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <div className="flex-1 flex-col overflow-auto bg-slate-50">
          <div className="mt-6 mb-3 ml-6 flex flex-col items-center justify-between md:flex-row md:items-end">
            <h1 className="text-2xl font-bold text-slate-800">
              {t("environments.surveys.templates.create_a_new_survey")}
            </h1>
            <div className="px-6">
              <SearchBar
                value={templateSearch ?? ""}
                onChange={setTemplateSearch}
                placeholder={t("common.search")}
                className="border-slate-700"
              />
            </div>
          </div>
          <TemplateList
            environmentId={environment.id}
            project={project}
            userId={userId}
            templateSearch={templateSearch ?? ""}
            onTemplateClick={(template) => {
              setActiveQuestionId(template.preset.questions[0].id);
              setActiveTemplate(template);
            }}
            prefilledFilters={prefilledFilters}
          />
        </div>
        <aside className="group hidden flex-1 flex-shrink-0 items-center justify-center overflow-hidden border-l border-slate-100 bg-slate-50 md:flex md:flex-col">
          {activeTemplate && (
            <PreviewSurvey
              survey={{ ...getMinimalSurvey(t), ...activeTemplate.preset }}
              questionId={activeQuestionId}
              project={project}
              environment={environment}
              languageCode={"default"}
            />
          )}
        </aside>
      </div>
    </div>
  );
};
