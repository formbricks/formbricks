"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useEnvironment } from "@/lib/environments/environments";
import { useProduct } from "@/lib/products/products";
import { replacePresetPlaceholders } from "@/lib/templates";
import type { Template } from "@formbricks/types/templates";
import { ErrorComponent } from "@formbricks/ui";
import { useEffect, useState } from "react";
import PreviewSurvey from "../PreviewSurvey";
import TemplateList from "./TemplateList";
import { templates } from "./templates";

export default function SurveyTemplatesPage({ params }) {
  const environmentId = params.environmentId;
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const { environment, isLoadingEnvironment, isErrorEnvironment } = useEnvironment(environmentId);

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);

  useEffect(() => {
    if (product && templates?.length) {
      const newTemplate = replacePresetPlaceholders(templates[0], product);
      setActiveTemplate(newTemplate);
      setActiveQuestionId(newTemplate.preset.questions[0].id);
    }
  }, [product]);

  if (isLoadingProduct || isLoadingEnvironment) return <LoadingSpinner />;
  if (isErrorProduct || isErrorEnvironment) return <ErrorComponent />;

  return (
    <div className="flex h-full flex-col ">
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <div className="flex-1 flex-col overflow-auto bg-slate-50">
          <h1 className="ml-6 mt-6 text-2xl font-bold text-slate-800">Create a new survey</h1>
          <TemplateList
            environmentId={environmentId}
            onTemplateClick={(template) => {
              setActiveQuestionId(template.preset.questions[0].id);
              setActiveTemplate(template);
            }}
          />
        </div>
        <aside className="group hidden flex-1 flex-shrink-0 items-center justify-center overflow-hidden border-l border-slate-100 bg-slate-50 md:flex md:flex-col">
          {activeTemplate && (
            <div className="my-6 flex h-full w-full flex-col items-center justify-center">
              <p className="pb-2 text-center text-sm font-normal text-slate-400">Preview</p>
              <PreviewSurvey
                activeQuestionId={activeQuestionId}
                questions={activeTemplate.preset.questions}
                brandColor={product.brandColor}
                setActiveQuestionId={setActiveQuestionId}
                environmentId={environmentId}
                surveyType={environment?.widgetSetupCompleted ? "web" : "link"}
                thankYouCard={{ enabled: true }}
                autoClose={null}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
