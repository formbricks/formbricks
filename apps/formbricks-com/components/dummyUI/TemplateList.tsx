import { OnboardingIcon } from "@formbricks/ui";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { createId } from "@paralleldrive/cuid2";
import clsx from "clsx";
import { useState } from "react";
import PreviewSurvey from "./PreviewSurvey";
import { templates } from "./templates";
import type { Template } from "./templateTypes";

export default function TemplateList() {
  const onboardingSegmentation: Template = {
    name: "Onboarding Segmentation",
    icon: OnboardingIcon,
    category: "Product Management",
    description: "Learn more about who signed up to your product and why.",
    preset: {
      name: "Onboarding Segmentation",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "What is your role?",
          subheader: "Please select one of the following options:",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Founder",
            },
            {
              id: createId(),
              label: "Executive",
            },
            {
              id: createId(),
              label: "Product Manager",
            },
            {
              id: createId(),
              label: "Product Owner",
            },
            {
              id: createId(),
              label: "Software Engineer",
            },
          ],
        },
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "What's your company size?",
          subheader: "Please select one of the following options:",
          required: true,
          choices: [
            {
              id: createId(),
              label: "only me",
            },
            {
              id: createId(),
              label: "1-5 employees",
            },
            {
              id: createId(),
              label: "6-10 employees",
            },
            {
              id: createId(),
              label: "11-100 employees",
            },
            {
              id: createId(),
              label: "over 100 employees",
            },
          ],
        },
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "How did you hear about us first?",
          subheader: "Please select one of the following options:",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Recommendation",
            },
            {
              id: createId(),
              label: "Social Media",
            },
            {
              id: createId(),
              label: "Ads",
            },
            {
              id: createId(),
              label: "Google Search",
            },
            {
              id: createId(),
              label: "in a Podcast",
            },
          ],
        },
      ],
    },
  };

  const [activeTemplate, setActiveTemplate] = useState<Template | null>(onboardingSegmentation);

  const categories = [...(Array.from(new Set(templates.map((template) => template.category))) as string[])];

  const [selectedFilter, setSelectedFilter] = useState(categories[0]);

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
    <div className="hidden h-full flex-col lg:flex">
      <div className="z-0  flex min-h-[90vh] overflow-hidden">
        <main className="relative z-0 max-h-[90vh] flex-1 overflow-y-auto rounded-l-lg bg-slate-100 px-6 py-6 focus:outline-none dark:bg-slate-700">
          <div className="mb-6 flex space-x-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedFilter(category)}
                className={clsx(
                  selectedFilter === category
                    ? "text-brand-dark border-brand-dark font-semibold"
                    : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400",
                  "rounded border  bg-slate-50 px-3 py-1 text-xs transition-all duration-150 dark:bg-slate-800 "
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
                    "duration-120  group  relative rounded-lg bg-white p-6 shadow transition-all duration-150 hover:scale-105 dark:bg-slate-600"
                  )}>
                  <div className="absolute right-6 top-6 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-300">
                    {template.category}
                  </div>
                  <template.icon className="h-8 w-8" />
                  <h3 className="text-md mb-1 mt-3 text-left font-bold text-slate-700 dark:text-slate-200">
                    {template.name}
                  </h3>
                  <p className="text-left text-xs text-slate-600 dark:text-slate-400">
                    {template.description}
                  </p>
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
              <h3 className="text-md mb-1 mt-3 text-left font-bold text-slate-700 dark:text-slate-200">
                {customSurvey.name}
              </h3>
              <p className="text-left text-xs text-slate-600 dark:text-slate-400">
                {customSurvey.description}
              </p>
            </button>
          </div>
        </main>
        <aside className="group relative hidden max-h-[90vh] flex-1 flex-shrink-0 overflow-hidden rounded-r-lg border-l border-slate-200 bg-slate-200 shadow-inner dark:border-slate-700 dark:bg-slate-800 md:flex md:flex-col">
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
