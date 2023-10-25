"use client";

import { TSurvey } from "@formbricks/types/surveys";
import { Confetti } from "@formbricks/ui/Confetti";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ShareEmbedSurvey from "./ShareEmbedSurvey";
import { TProduct } from "@formbricks/types/product";
import { TEnvironment } from "@formbricks/types/environment";
import { TProfile } from "@formbricks/types/profile";

interface SummaryMetadataProps {
  environment: TEnvironment;
  survey: TSurvey;
  surveyBaseUrl: string;
  product: TProduct;
  profile: TProfile;
  singleUseIds?: string[];
}

export default function SuccessMessage({
  environment,
  survey,
  surveyBaseUrl,
  product,
  profile,
}: SummaryMetadataProps) {
  const searchParams = useSearchParams();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
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
  }, [environment, searchParams, survey]);

  return (
    <>
      <ShareEmbedSurvey
        survey={survey}
        open={showLinkModal}
        setOpen={setShowLinkModal}
        surveyBaseUrl={surveyBaseUrl}
        product={product}
        profile={profile}
      />
      {confetti && <Confetti />}
    </>
  );
}
