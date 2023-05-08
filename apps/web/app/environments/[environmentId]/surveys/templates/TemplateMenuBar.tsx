"use client";

import { createSurvey } from "@/lib/surveys/surveys";
import type { Template } from "@formbricks/types/templates";
import { Button } from "@formbricks/ui/Button";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface TemplateMenuBarProps {
  activeTemplate: Template | null;
  environmentId: string;
}

export default function TemplateMenuBar({ activeTemplate, environmentId }: TemplateMenuBarProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const addSurvey = async (activeTemplate) => {
    setLoading(true);
    const survey = await createSurvey(environmentId, activeTemplate.preset);
    router.push(`/environments/${environmentId}/surveys/${survey.id}/edit`);
  };

  return (
    <div className="border-b border-slate-200 bg-white px-5 py-3 sm:flex sm:items-center sm:justify-between">
      <div className="flex items-center space-x-4">
        <Button variant="minimal" className="px-0" onClick={() => router.back()}>
          <ArrowLeftIcon className="h-5 w-5 text-slate-700" />
        </Button>
        <h1 className="font-slate-700 text-lg font-semibold">Start with a template</h1>
      </div>
      <div className="mt-3 flex sm:ml-4 sm:mt-0">
        <Button
          variant="highlight"
          disabled={activeTemplate === null}
          loading={loading}
          onClick={() => addSurvey(activeTemplate)}
          EndIcon={ArrowRightIcon}>
          Create Survey
        </Button>
      </div>
    </div>
  );
}
