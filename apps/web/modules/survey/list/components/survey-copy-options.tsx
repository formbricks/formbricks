"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getWorkspacesByWorkspaceIdAction } from "@/modules/survey/list/actions";
import { TSurvey } from "@/modules/survey/list/types/surveys";
import { TUserWorkspace } from "@/modules/survey/list/types/workspaces";
import { CopySurveyForm } from "./copy-survey-form";

interface SurveyCopyOptionsProps {
  survey: TSurvey;
  workspaceId: string;
  onCancel: () => void;
  setOpen: (value: boolean) => void;
}

const SurveyCopyOptions = ({ workspaceId, survey, onCancel, setOpen }: SurveyCopyOptionsProps) => {
  const [workspaces, setWorkspaces] = useState<TUserWorkspace[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);

  useEffect(() => {
    const fetchWorkspaces = async () => {
      const getWorkspacesByWorkspaceIdResponse = await getWorkspacesByWorkspaceIdAction({
        workspaceId,
      });
      if (getWorkspacesByWorkspaceIdResponse?.data) {
        setWorkspaces(getWorkspacesByWorkspaceIdResponse?.data);
      } else {
        const errorMessage = getFormattedErrorMessage(getWorkspacesByWorkspaceIdResponse);
        toast.error(errorMessage);
      }

      setWorkspaceLoading(false);
    };

    fetchWorkspaces();
  }, [workspaceId]);

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
