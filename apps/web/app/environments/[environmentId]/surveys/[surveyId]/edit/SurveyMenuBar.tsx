"use client";

import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSurveyMutation } from "@/lib/surveys/mutateSurveys";
import { useRouter } from "next/navigation";
import { Survey } from "@/types/surveys";

interface SurveyMenuBarProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
  environmentId: string;
  surveyId: string;
}

export default function SurveyMenuBar({
  localSurvey,
  environmentId,
  surveyId,
  setLocalSurvey,
}: SurveyMenuBarProps) {
  const router = useRouter();
  const { triggerSurveyMutate, isMutatingSurvey } = useSurveyMutation(environmentId, surveyId);

  return (
    <div className="border-b border-slate-200 bg-white py-3 px-5 sm:flex sm:items-center sm:justify-between">
      <Input
        defaultValue={localSurvey.name}
        onBlur={(e) => {
          triggerSurveyMutate({ name: e.target.value });
          const updatedSurvey = { ...localSurvey };
          updatedSurvey.name = e.target.value;
          setLocalSurvey(updatedSurvey);
        }}
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
          onClick={() => triggerSurveyMutate({ ...localSurvey })}>
          Save changes
        </Button>
        <Button
          variant="highlight"
          onClick={() => {
            triggerSurveyMutate({ ...localSurvey, status: "inProgress" });
            router.push(`/environments/${environmentId}/surveys/${surveyId}/summary?success=true`);
          }}>
          Publish Survey
        </Button>
      </div>
    </div>
  );
}
