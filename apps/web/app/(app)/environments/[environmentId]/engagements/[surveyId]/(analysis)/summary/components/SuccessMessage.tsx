"use client";

import { Confetti } from "@/modules/ui/components/confetti";
import { useTranslate } from "@tolgee/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";

interface SummaryMetadataProps {
  environment: TEnvironment;
  survey: TSurvey;
}

export const SuccessMessage = ({ environment, survey }: SummaryMetadataProps) => {
  const { t } = useTranslate();
  const searchParams = useSearchParams();
  const [confetti, setConfetti] = useState(false);

  const isAppSurvey = survey.type === "app";
  const widgetSetupCompleted = environment.appSetupCompleted;

  useEffect(() => {
    const newSurveyParam = searchParams?.get("success");
    if (newSurveyParam && survey && environment) {
      setConfetti(true);
      toast.success(
        isAppSurvey && !widgetSetupCompleted
          ? t("environments.surveys.summary.almost_there")
          : t("environments.surveys.summary.congrats"),
        {
          id: "survey-publish-success-toast",
          icon: isAppSurvey && !widgetSetupCompleted ? "🤏" : "🎉",
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
  }, [environment, isAppSurvey, searchParams, survey, widgetSetupCompleted, t]);

  return <>{confetti && <Confetti />}</>;
};
