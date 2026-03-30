"use client";

import type { Environment, Project } from "@prisma/client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TTemplate } from "@formbricks/types/templates";
import { customSurveyTemplate } from "@/app/lib/templates";
import { TemplateList } from "@/modules/survey/components/template-list";
import { MenuBar } from "@/modules/survey/templates/components/menu-bar";
import { PreviewSurvey } from "@/modules/ui/components/preview-survey";
import { SearchBar } from "@/modules/ui/components/search-bar";
import { getMinimalSurvey } from "../lib/minimal-survey";

type TemplateContainerWithPreviewProps = {
  project: Project;
  environment: Pick<Environment, "id" | "appSetupCompleted">;
  userId: string;
  isTemplatePage?: boolean;
  publicDomain: string;
};

export const TemplateContainerWithPreview = ({
  project,
  environment,
  userId,
  isTemplatePage = true,
  publicDomain,
}: TemplateContainerWithPreviewProps) => {
  const { t } = useTranslation();
  const initialTemplate = customSurveyTemplate(t);
  const [activeTemplate, setActiveTemplate] = useState<TTemplate>(initialTemplate);
  const [activeElementId, setActiveElementId] = useState<string>(
    initialTemplate.preset.blocks[0]?.elements[0]?.id || ""
  );
  const [templateSearch, setTemplateSearch] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      {isTemplatePage && <MenuBar />}
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <div className="flex-1 flex-col overflow-auto bg-slate-50">
          <div className="mb-3 ml-6 mt-6 flex flex-col items-center justify-between md:flex-row md:items-end">
            <h1 className="text-2xl font-bold text-slate-800">
              {isTemplatePage
                ? t("environments.surveys.templates.create_a_new_survey")
                : t("environments.surveys.all_set_time_to_create_first_survey")}
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
              setActiveElementId(template.preset.blocks[0]?.elements[0]?.id || "");
              setActiveTemplate(template);
            }}
          />
        </div>
        <aside className="group hidden flex-1 flex-shrink-0 items-center justify-center overflow-hidden border-l border-slate-100 bg-slate-50 md:flex md:flex-col">
          {activeTemplate && (
            <PreviewSurvey
              survey={{ ...getMinimalSurvey(t), ...activeTemplate.preset }}
              elementId={activeElementId}
              project={project}
              environment={environment}
              languageCode={"default"}
              isSpamProtectionAllowed={false} // setting it to false as this is a template
              publicDomain={publicDomain}
            />
          )}
        </aside>
      </div>
    </div>
  );
};
