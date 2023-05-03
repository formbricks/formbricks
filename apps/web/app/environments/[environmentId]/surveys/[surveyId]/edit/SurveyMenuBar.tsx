"use client";

import SurveyStatusDropdown from "@/components/shared/SurveyStatusDropdown";
import { useSurveyMutation } from "@/lib/surveys/mutateSurveys";
import type { Survey } from "@formbricks/types/surveys";
import { Button, Input } from "@formbricks/ui";
import { UserGroupIcon, ArrowLeftIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

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

  // write a function which updates the local survey status
  const updateLocalSurveyStatus = (status: Survey["status"]) => {
    const updatedSurvey = { ...localSurvey, status };
    setLocalSurvey(updatedSurvey);
  };

  return (
    <div className="border-b border-slate-200 bg-white px-5 py-3 sm:flex sm:items-center sm:justify-between">
      <div className="flex space-x-2 whitespace-nowrap">
        <Button variant="minimal" className="px-0" onClick={() => router.back()}>
          <ArrowLeftIcon className="h-5 w-5 text-slate-700" />
        </Button>
        <Input
          defaultValue={localSurvey.name}
          onChange={(e) => {
            const updatedSurvey = { ...localSurvey, name: e.target.value };
            setLocalSurvey(updatedSurvey);
          }}
          className="w-72"
        />
        <div className="flex items-center">
          <SurveyStatusDropdown
            surveyId={localSurvey.id}
            environmentId={environmentId}
            updateLocalSurveyStatus={updateLocalSurveyStatus}
          />
        </div>
      </div>
      <div className="mt-3 flex sm:ml-4 sm:mt-0">
        <Button
          variant="secondary"
          className="mr-3"
          loading={isMutatingSurvey}
          onClick={() => {
            triggerSurveyMutate({ ...localSurvey })
              .then(() => {
                toast.success("Changes saved.");
              })
              .catch((error) => {
                toast.error(`Error: ${error.message}`);
              });
            if (localSurvey.status !== "draft") {
              router.push(`/environments/${environmentId}/surveys/${localSurvey.id}/summary`);
            }
          }}>
          Save Changes
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
            disabled={
              localSurvey.type === "web" &&
              (localSurvey.triggers[0] === "" || localSurvey.triggers.length === 0)
            }
            variant="highlight"
            loading={isMutatingSurvey}
            onClick={async () => {
              await triggerSurveyMutate({ ...localSurvey, status: "inProgress" });
              router.push(`/environments/${environmentId}/surveys/${localSurvey.id}/summary?success=true`);
            }}>
            Publish Survey
          </Button>
        )}
      </div>
    </div>
  );
}
