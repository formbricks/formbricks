"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys";
import { TUser } from "@formbricks/types/user";
import { Confetti } from "@formbricks/ui/Confetti";

import { ShareEmbedSurvey } from "./ShareEmbedSurvey";

interface SummaryMetadataProps {
  environment: TEnvironment;
  survey: TSurvey;
  webAppUrl: string;
  user: TUser;
}

export const SuccessMessage = ({ environment, survey, webAppUrl, user }: SummaryMetadataProps) => {
  const searchParams = useSearchParams();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const isAppSurvey = survey.type === "app" || survey.type === "website";

  useEffect(() => {
    const newSurveyParam = searchParams?.get("success");
    if (newSurveyParam && survey && environment) {
      setConfetti(true);
      toast.success(
        isAppSurvey && !environment.widgetSetupCompleted
          ? "Almost there! Install widget to start receiving responses."
          : "Congrats! Your survey is live.",
        {
          icon: isAppSurvey && !environment.widgetSetupCompleted ? "🤏" : "🎉",
          duration: 5000,
          position: "bottom-right",
        }
      );
      if (survey.type === "link") {
        setShowLinkModal(true);
      }
      // Remove success param from url
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      window.history.replaceState({}, "", url.toString());
    }
  }, [environment, isAppSurvey, searchParams, survey]);

  return (
    <>
      <ShareEmbedSurvey
        survey={survey}
        open={showLinkModal}
        setOpen={setShowLinkModal}
        webAppUrl={webAppUrl}
        user={user}
      />
      {confetti && <Confetti />}
    </>
  );
};
