"use client";

import { useState } from "react";
import type { TTemplate } from "@formbricks/types/templates";
import { useEffect } from "react";
import { replacePresetPlaceholders } from "@/app/lib/templates";
import { minimalSurvey, templates } from "./templates";
import PreviewSurvey from "../components/PreviewSurvey";
import TemplateList from "./TemplateList";
import type { TProduct } from "@formbricks/types/product";
import type { TEnvironment } from "@formbricks/types/environment";
import { SearchBox } from "@formbricks/ui/SearchBox";
import { TProfile } from "@formbricks/types/profile";

type TemplateContainerWithPreviewProps = {
  environmentId: string;
  product: TProduct;
  environment: TEnvironment;
  profile: TProfile;
  IS_FORMBRICKS_CLOUD: boolean;
};

export default function TemplateContainerWithPreview({
  environmentId,
  product,
  environment,
  profile,
  IS_FORMBRICKS_CLOUD,
}: TemplateContainerWithPreviewProps) {
  const [activeTemplate, setActiveTemplate] = useState<TTemplate | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState<string | null>(null);
  useEffect(() => {
    if (product && templates?.length) {
      const newTemplate = replacePresetPlaceholders(templates[0], product);
      setActiveTemplate(newTemplate);
      setActiveQuestionId(newTemplate.preset.questions[0].id);
    }
  }, [product]);

  return (
    <div className="flex h-full flex-col ">
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <div className="flex-1 flex-col overflow-auto bg-slate-50">
          <div className="flex flex-col items-center justify-between md:flex-row md:items-start">
            <h1 className="ml-6 mt-6 text-2xl font-bold text-slate-800">Create a new survey</h1>
            <div className="ml-6 mt-6 px-6">
              <SearchBox
                autoFocus
                value={templateSearch ?? ""}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder={"Search..."}
                className="block rounded-md border border-slate-100 bg-white shadow-sm focus:border-slate-500 focus:outline-none focus:ring-0 sm:text-sm md:w-auto "
                type="search"
                name="search"
              />
            </div>
          </div>

          <TemplateList
            environmentId={environmentId}
            environment={environment}
            product={product}
            profile={profile}
            templateSearch={templateSearch ?? ""}
            onTemplateClick={(template) => {
              setActiveQuestionId(template.preset.questions[0].id);
              setActiveTemplate(template);
            }}
            IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
          />
        </div>
        <aside className="group hidden flex-1 flex-shrink-0 items-center justify-center overflow-hidden border-l border-slate-100 bg-slate-50 md:flex md:flex-col">
          {activeTemplate && (
            <div className="my-6 flex h-full w-full flex-col items-center justify-center">
              <p className="pb-2 text-center text-sm font-normal text-slate-400">Preview</p>
              <PreviewSurvey
                survey={{ ...minimalSurvey, ...activeTemplate.preset }}
                activeQuestionId={activeQuestionId}
                product={product}
                environment={environment}
                setActiveQuestionId={setActiveQuestionId}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
