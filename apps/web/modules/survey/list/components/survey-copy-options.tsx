"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getProjectsByEnvironmentIdAction } from "@/modules/survey/list/actions";
import { TUserProject } from "@/modules/survey/list/types/projects";
import { TSurvey } from "@/modules/survey/list/types/surveys";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CopySurveyForm } from "./copy-survey-form";

interface SurveyCopyOptionsProps {
  survey: TSurvey;
  environmentId: string;
  onCancel: () => void;
  setOpen: (value: boolean) => void;
}

const SurveyCopyOptions = ({ environmentId, survey, onCancel, setOpen }: SurveyCopyOptionsProps) => {
  const [projects, setProjects] = useState<TUserProject[]>([]);
  const [projectLoading, setProjectLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      const getProjectsByEnvironmentIdResponse = await getProjectsByEnvironmentIdAction({ environmentId });
      if (getProjectsByEnvironmentIdResponse?.data) {
        setProjects(getProjectsByEnvironmentIdResponse?.data);
      } else {
        const errorMessage = getFormattedErrorMessage(getProjectsByEnvironmentIdResponse);
        toast.error(errorMessage);
      }

      setProjectLoading(false);
    };

    fetchProjects();
  }, [environmentId]);

  if (projectLoading) {
    return (
      <div className="relative flex h-full min-h-96 w-full items-center justify-center bg-white pb-12">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return <CopySurveyForm defaultProjects={projects} survey={survey} onCancel={onCancel} setOpen={setOpen} />;
};

export default SurveyCopyOptions;
