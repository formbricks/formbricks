"use client";

import { FormbricksAICard } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/templates/components/FormbricksAICard";
import { MenuBar } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/templates/components/MenuBar";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { getCustomSurveyTemplate } from "@formbricks/lib/templates";
import type { TEnvironment } from "@formbricks/types/environment";
import type { TProduct, TProductConfigChannel, TProductConfigIndustry } from "@formbricks/types/product";
import type { TTemplate, TTemplateRole } from "@formbricks/types/templates";
import { TUser } from "@formbricks/types/user";
import { PreviewSurvey } from "@formbricks/ui/components/PreviewSurvey";
import { SearchBar } from "@formbricks/ui/components/SearchBar";
import { Separator } from "@formbricks/ui/components/Separator";
import { TemplateList } from "@formbricks/ui/components/TemplateList";
import { getMinimalSurvey } from "../../lib/minimalSurvey";

type TemplateContainerWithPreviewProps = {
  environmentId: string;
  product: TProduct;
  environment: TEnvironment;
  user: TUser;
  prefilledFilters: (TProductConfigChannel | TProductConfigIndustry | TTemplateRole | null)[];
  isAIEnabled: boolean;
};

export const TemplateContainerWithPreview = ({
  product,
  environment,
  user,
  prefilledFilters,
  isAIEnabled,
}: TemplateContainerWithPreviewProps) => {
  const t = useTranslations();
  const initialTemplate = getCustomSurveyTemplate(user.locale);
  const [activeTemplate, setActiveTemplate] = useState<TTemplate>(initialTemplate);
  const [activeQuestionId, setActiveQuestionId] = useState<string>(initialTemplate.preset.questions[0].id);
  const [templateSearch, setTemplateSearch] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <MenuBar />
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <div className="flex-1 flex-col overflow-auto bg-slate-50">
          <div className="mb-3 ml-6 mt-6 flex flex-col items-center justify-between md:flex-row md:items-end">
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

          {isAIEnabled && (
            <>
              <div className="px-6">
                <FormbricksAICard environmentId={environment.id} />
              </div>
              <Separator className="mt-4" />
            </>
          )}

          <TemplateList
            environment={environment}
            product={product}
            user={user}
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
              survey={{ ...getMinimalSurvey(user.locale), ...activeTemplate.preset }}
              questionId={activeQuestionId}
              product={product}
              environment={environment}
              languageCode={"default"}
              onFileUpload={async (file) => file.name}
            />
          )}
        </aside>
      </div>
    </div>
  );
};
