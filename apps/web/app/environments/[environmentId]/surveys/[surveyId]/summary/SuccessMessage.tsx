"use client";

import { useEnvironment } from "@/lib/environments/environments";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { Confetti } from "@formbricks/ui";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import LinkSurveyModal from "./LinkSurveyModal";

interface SummaryMetadataProps {
  environmentId: string;
  survey: TSurvey;
}

export default function SuccessMessage({ environmentId, survey }: SummaryMetadataProps) {
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
      }
    }
  }, [environment, searchParams, survey]);

  return (
    <>
      {showLinkModal && <LinkSurveyModal survey={survey} open={showLinkModal} setOpen={setShowLinkModal} />}
      {confetti && <Confetti />}
    </>
  );
}
