"use client";

import { useEnvironment } from "@/lib/environments/environments";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { Confetti } from "@formbricks/ui";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import LinkSurveyModal from "./LinkSurveyModal";
import LinkSingleUseSurveyModal from "./LinkSingleUseSurveyModal";

interface SummaryMetadataProps {
  environmentId: string;
  survey: TSurvey;
  surveyBaseUrl: string;
}

export default function SuccessMessage({ environmentId, survey, surveyBaseUrl }: SummaryMetadataProps) {
  const isSingleUse = survey.singleUse?.enabled ?? false;
  const { environment } = useEnvironment(environmentId);
  const searchParams = useSearchParams();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [confetti, setConfetti] = useState(false);
  useEffect(() => {
    if (environment) {
      const newSurveyParam = searchParams?.get("success");
      if (newSurveyParam && survey && environment) {
        setConfetti(true);
        toast.success(
          survey.type === "web" && !environment.widgetSetupCompleted
            ? "Almost there! Install widget to start receiving responses."
            : "Congrats! Your survey is live.",
          {
            icon: survey.type === "web" && !environment.widgetSetupCompleted ? "🤏" : "🎉",
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
    }
  }, [environment, searchParams, survey]);

  return (
    <>
      {showLinkModal && isSingleUse ? (
        <LinkSingleUseSurveyModal survey={survey} open={showLinkModal} setOpen={setShowLinkModal} />
      ) : (
        <LinkSurveyModal
          survey={survey}
          open={showLinkModal}
          setOpen={setShowLinkModal}
          surveyBaseUrl={surveyBaseUrl}
        />
      )}
      {confetti && <Confetti />}
    </>
  );
}
