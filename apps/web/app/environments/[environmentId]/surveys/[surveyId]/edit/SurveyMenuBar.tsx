"use client";

import { Button } from "@formbricks/ui";
import { Input } from "@formbricks/ui";
import { useSurveyMutation } from "@/lib/surveys/mutateSurveys";
import type { Survey } from "@formbricks/types/surveys";
import { UserGroupIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface SurveyMenuBarProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
  environmentId: string;
  activeId: "questions" | "audience";
  setActiveId: (id: "questions" | "audience") => void;
}

export default function SurveyMenuBar({
  localSurvey,
  environmentId,
  setLocalSurvey,
  activeId,
  setActiveId,
}: SurveyMenuBarProps) {
  const router = useRouter();
  const { triggerSurveyMutate, isMutatingSurvey } = useSurveyMutation(environmentId, localSurvey.id);
  const [audiencePrompt, setAudiencePrompt] = useState(true);

  useEffect(() => {
    if (audiencePrompt && activeId === "audience") {
      setAudiencePrompt(false);
    }
  }, [activeId, audiencePrompt]);

  return (
    <div className="border-b border-slate-200 bg-white py-3 px-5 sm:flex sm:items-center sm:justify-between">
      <Input
        defaultValue={localSurvey.name}
        onChange={(e) => {
          const updatedSurvey = { ...localSurvey, name: e.target.value };
          setLocalSurvey(updatedSurvey);
        }}
        className="max-w-md"
      />
      <div className="mt-3 flex sm:mt-0 sm:ml-4">
        <Button variant="minimal" className="mr-3" href={`/environments/${environmentId}/surveys/`}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          className="mr-3"
          loading={isMutatingSurvey}
          onClick={() => {
            triggerSurveyMutate({ ...localSurvey });
            if (localSurvey.status !== "draft") {
              router.push(`/environments/${environmentId}/surveys/${localSurvey.id}/summary?success=true`);
            }
          }}>
          Save changes
        </Button>
        {localSurvey.status === "draft" && audiencePrompt && (
          <Button
            variant="highlight"
            onClick={() => {
              setAudiencePrompt(false);
              setActiveId("audience");
            }}>
            <UserGroupIcon className="mr-1 h-4 w-4" /> Continue to Audience
          </Button>
        )}
        {localSurvey.status === "draft" && !audiencePrompt && (
          <Button
            disabled={localSurvey.triggers[0] === "" || localSurvey.triggers.length === 0}
            variant="highlight"
            onClick={() => {
              triggerSurveyMutate({ ...localSurvey, status: "inProgress" });
              router.push(`/environments/${environmentId}/surveys/${localSurvey.id}/summary?success=true`);
            }}>
            Publish Survey
          </Button>
        )}
      </div>
    </div>
  );
}
