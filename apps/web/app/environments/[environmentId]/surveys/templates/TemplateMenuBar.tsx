"use client";

import Button from "@/components/ui/Button";
import type { Template } from "@/types/templates";
import { createSurvey } from "@/lib/surveys/surveys";
import { useRouter } from "next/navigation";

interface TemplateMenuBarProps {
  activeTemplate: Template | null;
  environmentId: string;
}

export default function TemplateMenuBar({ activeTemplate, environmentId }: TemplateMenuBarProps) {
  const router = useRouter();
  const addSurvey = async (activeTemplate) => {
    const survey = await createSurvey(environmentId, activeTemplate.preset);
    router.push(`/environments/${environmentId}/surveys/${survey.id}/edit`);
  };

  return (
    <div className="border-b border-slate-200 bg-white py-3 px-5 sm:flex sm:items-center sm:justify-between">
      <h1 className="font-slate-700 text-lg font-semibold">Start with a template</h1>
      <div className="mt-3 flex sm:mt-0 sm:ml-4">
        <Button variant="secondary" className="mr-3" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          variant="highlight"
          disabled={activeTemplate === null}
          onClick={() => addSurvey(activeTemplate)}>
          Create Survey
        </Button>
      </div>
    </div>
  );
}
