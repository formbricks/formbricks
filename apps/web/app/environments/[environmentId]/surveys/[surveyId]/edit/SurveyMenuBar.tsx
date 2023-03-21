"use client";

import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSurveyMutation } from "@/lib/surveys/mutateSurveys";
import { useSurvey } from "@/lib/surveys/surveys";
import type { Question } from "@/types/questions";
import { useRouter } from "next/navigation";

interface SurveyMenuBarProps {
  questions: Question[];
  triggers: string[];
  environmentId: string;
  surveyId: string;
  showSetting: "once" | "always";
}

export default function SurveyMenuBar({
  questions,
  triggers,
  environmentId,
  surveyId,
  showSetting,
}: SurveyMenuBarProps) {
  const router = useRouter();
  const { survey } = useSurvey(environmentId, surveyId);
  const { triggerSurveyMutate, isMutatingSurvey } = useSurveyMutation(environmentId, surveyId);

  return (
    <div className="border-b border-slate-200 bg-white py-3 px-5 sm:flex sm:items-center sm:justify-between">
      <Input
        defaultValue={survey.name}
        onBlur={(e) => triggerSurveyMutate({ name: e.target.value })}
        className="max-w-md"
      />
      <div className="mt-3 flex sm:mt-0 sm:ml-4">
        <Button variant="secondary" className="mr-3" href={`/environments/${environmentId}/surveys/`}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          className="mr-3"
          loading={isMutatingSurvey}
          onClick={() => triggerSurveyMutate({ questions, triggers, show: showSetting })}>
          Save changes
        </Button>
        <Button
          variant="highlight"
          onClick={() => {
            triggerSurveyMutate({ status: "inProgress", questions, triggers, show: showSetting });
            router.push(`/environments/${environmentId}/surveys/${surveyId}/summary?success=true`);
          }}>
          Publish Survey
        </Button>
      </div>
    </div>
  );
}
