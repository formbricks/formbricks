"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Confetti } from "@formbricks/ui/Confetti";

interface SummaryMetadataProps {
  environment: TEnvironment;
  survey: TSurvey;
}

export const SuccessMessage = ({ environment, survey }: SummaryMetadataProps) => {
  const searchParams = useSearchParams();
  const [confetti, setConfetti] = useState(false);

  const isAppSurvey = survey.type === "app" || survey.type === "website";
  const widgetSetupCompleted =
    survey.type === "app" ? environment.appSetupCompleted : environment.websiteSetupCompleted;

  useEffect(() => {
    const newSurveyParam = searchParams?.get("success");
    if (newSurveyParam && survey && environment) {
      setConfetti(true);
      toast.success(
        isAppSurvey && !widgetSetupCompleted
          ? "Almost there! Install widget to start receiving responses."
          : "Congrats! Your survey is live.",
        {
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
  }, [environment, isAppSurvey, searchParams, survey, widgetSetupCompleted]);

  return <>{confetti && <Confetti />}</>;
};
