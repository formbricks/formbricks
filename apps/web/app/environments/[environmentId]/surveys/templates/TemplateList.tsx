"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProduct } from "@/lib/products/products";
import { cn } from "@/lib/utils";
import type { Template } from "@/types/templates";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { createId } from "@paralleldrive/cuid2";
import { useState } from "react";
import PreviewSurvey from "../PreviewSurvey";
import TemplateMenuBar from "./TemplateMenuBar";
import { templates } from "./templates";

export default function TemplateList({ environmentId }: { environmentId: string }) {
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);

  if (isLoadingProduct) return <LoadingSpinner />;
  if (isErrorProduct) return <div>Error...</div>;

  const customSurvey: Template = {
    name: "Custom Survey",
    description: "Create your survey from scratch.",
    icon: null,
    preset: {
      name: "New Survey",
      questions: [
        {
          id: createId(),
          type: "openText",
          headline: "What's poppin?",
          subheader: "This can help us improve your experience.",
          placeholder: "Type your answer here...",
          required: true,
        },
      ],
    },
  };

  return (
    <div className="flex h-full flex-col">
      <TemplateMenuBar activeTemplate={activeTemplate} environmentId={environmentId} />
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <main className="relative z-0 flex-1 overflow-y-auto p-8 focus:outline-none">
          <h1 className="my-2 text-3xl font-bold text-slate-800">New Survey</h1>
          <p className="mb-6 text-slate-500">
            Choose from one of the templates below to create a new survey.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {templates.map((template: Template) => (
              <button
                type="button"
                onClick={() => setActiveTemplate(template)}
                key={template.name}
                className={cn(
                  activeTemplate?.name === template.name && "ring-brand ring-2",
                  "duration-120 relative rounded-lg  bg-white p-8 shadow hover:bg-slate-50"
                )}>
                <template.icon className="h-8 w-8" />
                <h3 className="text-md mt-3 mb-1 text-left font-bold text-slate-700">{template.name}</h3>
                <p className="text-left text-xs text-slate-600">{template.description}</p>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setActiveTemplate(customSurvey)}
              className={cn(
                activeTemplate?.name === customSurvey.name && "ring-brand ring-2",
                "duration-120 relative rounded-lg border-2 border-dashed border-slate-300 bg-transparent p-8 hover:bg-slate-50"
              )}>
              <PlusCircleIcon className="h-8 w-8" />
              <h3 className="text-md mt-3 mb-1 text-left font-bold text-slate-700 ">{customSurvey.name}</h3>
              <p className="text-left text-xs text-slate-600 ">{customSurvey.description}</p>
            </button>
          </div>
        </main>
        <aside className="relative hidden h-full flex-1 flex-shrink-0 overflow-hidden border-l border-slate-200 bg-slate-200 shadow-inner md:flex md:flex-col">
          {activeTemplate && (
            <PreviewSurvey
              activeQuestionId={null}
              questions={activeTemplate.preset.questions}
              brandColor={product.brandColor}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
