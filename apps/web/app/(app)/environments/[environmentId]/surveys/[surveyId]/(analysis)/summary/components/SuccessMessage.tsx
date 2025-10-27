"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Confetti } from "@/modules/ui/components/confetti";

interface SummaryMetadataProps {
  environment: TEnvironment;
  survey: TSurvey;
}

export const SuccessMessage = ({ environment, survey }: SummaryMetadataProps) => {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [confetti, setConfetti] = useState(false);

  const isAppSurvey = survey.type === "app";
  const appSetupCompleted = environment.appSetupCompleted;

  useEffect(() => {
    const newSurveyParam = searchParams?.get("success");
    if (newSurveyParam && survey && environment) {
      setConfetti(true);
      toast.success(
        isAppSurvey && !appSetupCompleted
          ? t("environments.surveys.summary.almost_there")
          : t("environments.surveys.summary.congrats"),
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
  }, [environment, isAppSurvey, searchParams, survey, appSetupCompleted, t]);

  return <>{confetti && <Confetti />}</>;
};
