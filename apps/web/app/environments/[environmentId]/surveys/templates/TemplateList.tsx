"use client";

import { createSurvey } from "@/lib/surveys/surveys";
import type { Template } from "@/types/template";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { createId } from "@paralleldrive/cuid2";
import { useRouter } from "next/navigation";
import { templates } from "./templates";

export default function TemplateList({ environmentId }: { environmentId: string }) {
  const router = useRouter();

  const customSurvey = {
    name: "New Survey",
    questions: [
      {
        id: createId(),
        type: "openText",
        subheader: "This can help us improve your experience.",
        placeholder: "Type your answer here...",
      },
    ],
  };

  const addSurvey = async (template?: Template) => {
    const survey = await createSurvey(environmentId, template?.preset || customSurvey);
    router.push(`/environments/${environmentId}/surveys/${survey.id}/edit`);
  };

  return (
    <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2">
      {templates.map((template: Template) => (
        <button
          type="button"
          onClick={() => addSurvey(template)}
          key={template.name}
          className="drop-shadow-card duration-120 relative rounded-lg bg-slate-100 p-8 hover:bg-slate-200">
          <template.icon className="h-8 w-8" />
          <h3 className="text-md mt-3 mb-1 text-left font-bold text-slate-700">{template.name}</h3>
          <p className="text-left text-xs text-slate-600">{template.description}</p>
        </button>
      ))}
      <button
        type="button"
        onClick={() => addSurvey()}
        className="drop-shadow-card duration-120 relative rounded-lg border-2 border-dashed border-slate-300 bg-transparent p-8 hover:bg-slate-200">
        <PlusCircleIcon className="h-8 w-8" />
        <h3 className="text-md mt-3 mb-1 text-left font-bold text-slate-700 ">Custom Survey</h3>
        <p className="text-left text-xs text-slate-600 ">
          Skip templates and create your survey from scratch.
        </p>
      </button>
    </div>
  );
}
