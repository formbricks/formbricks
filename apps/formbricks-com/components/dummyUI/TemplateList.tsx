import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { PaintBrushIcon } from "@heroicons/react/24/solid"; /*
import { replacePresetPlaceholders } from "@/lib/templates"; */
import { createId } from "@paralleldrive/cuid2";
import clsx from "clsx";
import { useState } from "react";
import PreviewSurvey from "./PreviewSurvey";
import { templates } from "./templates";
import type { Template } from "./templateTypes";

export default function TemplateList() {
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const categories = [
    "All",
    ...(Array.from(new Set(templates.map((template) => template.category))) as string[]),
  ];

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
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <main className="relative z-0 max-h-[90vh] flex-1 overflow-y-auto rounded-l-lg bg-slate-100 py-6 px-6 focus:outline-none">
          <div className="mb-6 flex space-x-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedFilter(category)}
                className={clsx(
                  selectedFilter === category
                    ? "text-brand-dark border-brand-dark font-semibold"
                    : "border-slate-300 text-slate-700 hover:bg-slate-100",
                  "rounded border  bg-slate-50 px-3 py-1 text-xs transition-all duration-150 "
                )}>
                {category}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4  sm:grid-cols-2">
            {templates
              .filter((template) => selectedFilter === "All" || template.category === selectedFilter)
              .map((template: Template) => (
                <button
                  type="button"
                  onClick={() => setActiveTemplate(template)}
                  key={template.name}
                  className={clsx(
                    activeTemplate?.name === template.name && "ring-brand ring-2",
                    "duration-120  group  relative rounded-lg bg-white p-6 shadow transition-all duration-150 hover:scale-105"
                  )}>
                  <div className="absolute top-6 right-6 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500">
                    {template.category}
                  </div>
                  <template.icon className="h-8 w-8" />
                  <h3 className="text-md mt-3 mb-1 text-left font-bold text-slate-700">{template.name}</h3>
                  <p className="text-left text-xs text-slate-600">{template.description}</p>
                </button>
              ))}
            <button
              type="button"
              onClick={() => setActiveTemplate(customSurvey)}
              className={clsx(
                activeTemplate?.name === customSurvey.name && "ring-brand ring-2",
                "duration-120 hover:border-brand-dark group relative rounded-lg border-2 border-dashed border-slate-300 bg-transparent p-8 transition-colors duration-150"
              )}>
              <PlusCircleIcon className="text-brand-dark h-8 w-8 transition-all duration-150 group-hover:scale-110" />
              <h3 className="text-md mt-3 mb-1 text-left font-bold text-slate-700 ">{customSurvey.name}</h3>
              <p className="text-left text-xs text-slate-600 ">{customSurvey.description}</p>
            </button>
          </div>
        </main>
        <aside className="group relative hidden max-h-[90vh] flex-1 flex-shrink-0 overflow-hidden rounded-r-lg border-l border-slate-200 bg-slate-200 shadow-inner md:flex md:flex-col">
          {activeTemplate && (
            <PreviewSurvey
              activeQuestionId={null}
              questions={activeTemplate.preset.questions}
              brandColor="#00C4B8"
            />
          )}
        </aside>
      </div>
    </div>
  );
}
