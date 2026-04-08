"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { useWorkspaceContext } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { Confetti } from "@/modules/ui/components/confetti";

interface SummaryMetadataProps {
  survey: TSurvey;
}

export const SuccessMessage = ({ survey }: SummaryMetadataProps) => {
  const { t } = useTranslation();
  const { workspace } = useWorkspaceContext();
  const searchParams = useSearchParams();
  const [confetti, setConfetti] = useState(false);

  const isAppSurvey = survey.type === "app";
  const appSetupCompleted = workspace.appSetupCompleted;

  useEffect(() => {
    const newSurveyParam = searchParams?.get("success");
    if (newSurveyParam && survey && workspace) {
      setConfetti(true);
      toast.success(
        isAppSurvey && !appSetupCompleted
          ? t("workspace.surveys.summary.almost_there")
          : t("workspace.surveys.summary.congrats"),
        {
          id: "survey-publish-success-toast",
          icon: isAppSurvey && !appSetupCompleted ? "🤏" : "🎉",
          duration: 5000,
          position: "bottom-right",
        }
      );

      // Remove success param from url
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      if (survey.type === "link") {
        // Add share param to url to open share embed modal
        url.searchParams.set("share", "true");
      }

      window.history.replaceState({}, "", url.toString());
    }
  }, [workspace, isAppSurvey, searchParams, survey, appSetupCompleted, t]);

  return <>{confetti && <Confetti />}</>;
};
