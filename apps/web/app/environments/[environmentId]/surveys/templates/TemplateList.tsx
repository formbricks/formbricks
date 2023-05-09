"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProduct } from "@/lib/products/products";
import { useProfile } from "@/lib/profile";
import { replacePresetPlaceholders } from "@/lib/templates";
import { cn } from "@formbricks/lib/cn";
import type { Template } from "@formbricks/types/templates";
import { ErrorComponent } from "@formbricks/ui";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { SparklesIcon } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
import { customSurvey, templates } from "./templates";

type TemplateList = {
  environmentId: string;
  onTemplateClick: (template: Template) => void;
};

const ALL_CATEGORY_NAME = "All";
const RECOMMENDED_CATEGORY_NAME = "For you";

export default function TemplateList({ environmentId, onTemplateClick }: TemplateList) {
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);

  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);
  const { profile, isLoadingProfile, isErrorProfile } = useProfile();
  const [selectedFilter, setSelectedFilter] = useState(RECOMMENDED_CATEGORY_NAME);

  const [categories, setCategories] = useState<Array<string>>([]);

  useEffect(() => {
    if (product && templates?.length) {
      setActiveTemplate(null);
    }
  }, [product]);

  useEffect(() => {
    const defaultCategories = [
      /* ALL_CATEGORY_NAME, */
      ...(Array.from(new Set(templates.map((template) => template.category))) as string[]),
    ];

    const fullCategories =
      !!profile?.objective && profile.objective !== "other"
        ? [RECOMMENDED_CATEGORY_NAME, ...defaultCategories]
        : [ALL_CATEGORY_NAME, ...defaultCategories];

    setCategories(fullCategories);

    const activeFilter =
      !!profile?.objective && profile.objective !== "other" ? RECOMMENDED_CATEGORY_NAME : ALL_CATEGORY_NAME;
    setSelectedFilter(activeFilter);
  }, [profile]);

  if (isLoadingProduct || isLoadingProfile) return <LoadingSpinner />;
  if (isErrorProduct || isErrorProfile) return <ErrorComponent />;

  return (
    <main className="relative z-0 flex-1 overflow-y-auto px-8 py-6 focus:outline-none">
      <div className="mb-6 flex flex-wrap space-x-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedFilter(category)}
            className={cn(
              selectedFilter === category
                ? "text-brand-dark border-brand-dark font-semibold"
                : "border-slate-300 text-slate-700 hover:bg-slate-100",
              "mt-2 rounded  border bg-slate-50 px-3 py-1 text-sm transition-all duration-150 "
            )}>
            {category}
            {category === RECOMMENDED_CATEGORY_NAME && <SparklesIcon className="ml-1 inline h-5 w-5" />}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            const newTemplate = replacePresetPlaceholders(customSurvey, product);
            onTemplateClick(newTemplate);
            setActiveTemplate(newTemplate);
          }}
          className={cn(
            activeTemplate?.name === customSurvey.name
              ? "ring-brand border-transparent ring-2"
              : "hover:border-brand-dark  border-dashed border-slate-300",
            "duration-120  group relative rounded-lg border-2  bg-transparent p-8 transition-colors duration-150"
          )}>
          <PlusCircleIcon className="text-brand-dark h-8 w-8 transition-all duration-150 group-hover:scale-110" />
          <h3 className="text-md mb-1 mt-3 text-left font-bold text-slate-700 ">{customSurvey.name}</h3>
          <p className="text-left text-xs text-slate-600 ">{customSurvey.description}</p>
        </button>
        {templates
          .filter(
            (template) =>
              selectedFilter === ALL_CATEGORY_NAME ||
              template.category === selectedFilter ||
              (selectedFilter === RECOMMENDED_CATEGORY_NAME &&
                template.objectives?.includes(profile.objective))
          )
          .map((template: Template) => (
            <button
              type="button"
              onClick={() => {
                const newTemplate = replacePresetPlaceholders(template, product);
                onTemplateClick(newTemplate);
                setActiveTemplate(newTemplate);
              }}
              key={template.name}
              className={cn(
                activeTemplate?.name === template.name && "ring-brand ring-2",
                "duration-120  group  relative rounded-lg bg-white p-6 shadow transition-all duration-150 hover:scale-105"
              )}>
              <div className="absolute right-6 top-6 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500">
                {template.category}
              </div>
              <template.icon className="h-8 w-8" />
              <h3 className="text-md mb-1 mt-3 text-left font-bold text-slate-700">{template.name}</h3>
              <p className="text-left text-xs text-slate-600">{template.description}</p>
            </button>
          ))}
      </div>
    </main>
  );
}
