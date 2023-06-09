import type { Template } from "@formbricks/types/templates";
import { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { templates } from "./templates";

type TemplateList = {
  onTemplateClick: (template: Template) => void;
  activeTemplate: Template | null;
};

const ALL_CATEGORY_NAME = "All";

export default function TemplateList({ onTemplateClick, activeTemplate }: TemplateList) {
  const [selectedFilter, setSelectedFilter] = useState(ALL_CATEGORY_NAME);

  const [categories, setCategories] = useState<Array<string>>([]);

  useEffect(() => {
    const defaultCategories = [
      /*  ALL_CATEGORY_NAME, */
      ...(Array.from(new Set(templates.map((template) => template.category))) as string[]),
    ];

    const fullCategories = [ALL_CATEGORY_NAME, ...defaultCategories];

    setCategories(fullCategories);

    const activeFilter = ALL_CATEGORY_NAME;
    setSelectedFilter(activeFilter);
  }, []);

  return (
    <main className="relative z-0 flex-1 overflow-y-auto rounded-l-lg bg-slate-100 px-8 py-6 focus:outline-none dark:bg-slate-800">
      <div className="mb-6 flex flex-wrap space-x-1">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedFilter(category)}
            className={cn(
              selectedFilter === category
                ? "text-brand-dark border-brand-dark font-semibold"
                : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300",
              "mt-2 rounded border bg-slate-50 px-3 py-1 text-xs transition-all duration-150 dark:bg-slate-600 dark:hover:bg-slate-500"
            )}>
            {category}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {templates
          .filter((template) => selectedFilter === ALL_CATEGORY_NAME || template.category === selectedFilter)
          .map((template: Template) => (
            <button
              type="button"
              onClick={() => {
                onTemplateClick(template); // Pass the 'template' object instead of 'activeTemplate'
              }}
              key={template.name}
              className={cn(
                activeTemplate?.name === template.name && "ring-brand ring-2",
                "duration-120  group  relative rounded-lg bg-white p-6 shadow transition-all duration-150 hover:scale-105 dark:bg-slate-700"
              )}>
              <div className="absolute right-6 top-6 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500 dark:border-slate-400 dark:bg-slate-800 dark:text-slate-400">
                {template.category}
              </div>
              <template.icon className="h-8 w-8" />
              <h3 className="text-md mb-1 mt-3 text-left font-bold text-slate-700 dark:text-slate-300">
                {template.name}
              </h3>
              <p className="text-left text-xs text-slate-600 dark:text-slate-400">{template.description}</p>
            </button>
          ))}
      </div>
    </main>
  );
}
