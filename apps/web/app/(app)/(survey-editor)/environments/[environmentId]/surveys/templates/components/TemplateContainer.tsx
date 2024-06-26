"use client";

import { MenuBar } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/templates/components/MenuBar";
import { useState } from "react";
import { customSurvey } from "@formbricks/lib/templates";
import type { TEnvironment } from "@formbricks/types/environment";
import type { TProduct, TProductConfigChannel, TProductConfigIndustry } from "@formbricks/types/product";
import type { TTemplate, TTemplateRole } from "@formbricks/types/templates";
import { TUser } from "@formbricks/types/user";
import { PreviewSurvey } from "@formbricks/ui/PreviewSurvey";
import { SearchBox } from "@formbricks/ui/SearchBox";
import { TemplateList } from "@formbricks/ui/TemplateList";
import { minimalSurvey } from "../../lib/minimalSurvey";

type TemplateContainerWithPreviewProps = {
  environmentId: string;
  product: TProduct;
  environment: TEnvironment;
  user: TUser;
  prefilledFilters: (TProductConfigChannel | TProductConfigIndustry | TTemplateRole | null)[];
};

export const TemplateContainerWithPreview = ({
  product,
  environment,
  user,
  prefilledFilters,
}: TemplateContainerWithPreviewProps) => {
  const initialTemplate = customSurvey;
  const [activeTemplate, setActiveTemplate] = useState<TTemplate>(initialTemplate);
  const [activeQuestionId, setActiveQuestionId] = useState<string>(initialTemplate.preset.questions[0].id);
  const [templateSearch, setTemplateSearch] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <MenuBar />
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <div className="flex-1 flex-col overflow-auto bg-slate-50">
          <div className="mb-3 ml-6 mt-6 flex flex-col items-center justify-between md:flex-row md:items-end">
            <h1 className="text-2xl font-bold text-slate-800">Create a new survey</h1>
            <div className="px-6">
              <SearchBox
                autoFocus
                value={templateSearch ?? ""}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder={"Search..."}
                className="block rounded-md border border-slate-100 bg-white shadow-sm focus:border-slate-500 focus:outline-none focus:ring-0 sm:text-sm md:w-auto"
                type="search"
                name="search"
              />
            </div>
          </div>

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
            <div className="my-6 flex h-[90%] w-full flex-col items-center justify-center">
              <PreviewSurvey
                survey={{ ...minimalSurvey, ...activeTemplate.preset }}
                questionId={activeQuestionId}
                product={product}
                environment={environment}
                languageCode={"default"}
                onFileUpload={async (file) => file.name}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
