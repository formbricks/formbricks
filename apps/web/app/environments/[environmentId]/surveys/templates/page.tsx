"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProduct } from "@/lib/products/products";
import { replacePresetPlaceholders } from "@/lib/templates";
import type { Template } from "@formbricks/types/templates";
import { ErrorComponent } from "@formbricks/ui";
import { PaintBrushIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { useEffect, useState } from "react";
import PreviewSurvey from "../PreviewSurvey";
import TemplateList from "./TemplateList";
import TemplateMenuBar from "./TemplateMenuBar";
import { templates } from "./templates";

export default function SurveyTemplatesPage({ params }) {
  const environmentId = params.environmentId;
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);

  useEffect(() => {
    if (product && templates?.length) {
      const newTemplate = replacePresetPlaceholders(templates[0], product);
      setActiveTemplate(newTemplate);
      setActiveQuestionId(newTemplate.preset.questions[0].id);
    }
  }, [product]);

  if (isLoadingProduct) return <LoadingSpinner />;
  if (isErrorProduct) return <ErrorComponent />;

  return (
    <div className="flex h-full flex-col">
      <TemplateMenuBar activeTemplate={activeTemplate} environmentId={environmentId} />
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <TemplateList
          environmentId={environmentId}
          onTemplateClick={(template) => {
            setActiveQuestionId(template.preset.questions[0].id);
            setActiveTemplate(template);
          }}
        />
        <aside className="group relative hidden h-full flex-1 flex-shrink-0 overflow-hidden border-l border-slate-200 bg-slate-200 shadow-inner md:flex md:flex-col">
          <Link
            href={`/environments/${environmentId}/settings/lookandfeel`}
            className="absolute left-6 top-6 z-50 flex items-center rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-500 opacity-0 transition-all duration-500 hover:scale-105 hover:bg-slate-100 group-hover:opacity-100">
            Update brand color <PaintBrushIcon className="ml-1.5 h-3 w-3" />
          </Link>
          {activeTemplate && (
            <PreviewSurvey
              activeQuestionId={activeQuestionId}
              questions={activeTemplate.preset.questions}
              brandColor={product.brandColor}
              setActiveQuestionId={setActiveQuestionId}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
