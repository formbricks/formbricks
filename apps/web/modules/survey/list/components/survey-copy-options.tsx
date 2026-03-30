"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getWorkspacesByEnvironmentIdAction } from "@/modules/survey/list/actions";
import { TSurvey } from "@/modules/survey/list/types/surveys";
import { TUserWorkspace } from "@/modules/survey/list/types/workspaces";
import { CopySurveyForm } from "./copy-survey-form";

interface SurveyCopyOptionsProps {
  survey: TSurvey;
  environmentId: string;
  onCancel: () => void;
  setOpen: (value: boolean) => void;
}

const SurveyCopyOptions = ({ environmentId, survey, onCancel, setOpen }: SurveyCopyOptionsProps) => {
  const [workspaces, setWorkspaces] = useState<TUserWorkspace[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);

  useEffect(() => {
    const fetchWorkspaces = async () => {
      const getWorkspacesByEnvironmentIdResponse = await getWorkspacesByEnvironmentIdAction({
        environmentId,
      });
      if (getWorkspacesByEnvironmentIdResponse?.data) {
        setWorkspaces(getWorkspacesByEnvironmentIdResponse?.data);
      } else {
        const errorMessage = getFormattedErrorMessage(getWorkspacesByEnvironmentIdResponse);
        toast.error(errorMessage);
      }

      setWorkspaceLoading(false);
    };

    fetchWorkspaces();
  }, [environmentId]);

  if (workspaceLoading) {
    return (
      <div className="relative flex h-full min-h-96 w-full items-center justify-center bg-white pb-12">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <CopySurveyForm defaultWorkspaces={workspaces} survey={survey} onCancel={onCancel} setOpen={setOpen} />
  );
};

export default SurveyCopyOptions;
