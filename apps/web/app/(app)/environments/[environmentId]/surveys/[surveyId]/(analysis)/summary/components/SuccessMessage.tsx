"use client";

import { TSurvey } from "@formbricks/types/surveys";
import { Confetti } from "@formbricks/ui/Confetti";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ShareEmbedSurvey from "./ShareEmbedSurvey";
import { TProduct } from "@formbricks/types/product";
import { TEnvironment } from "@formbricks/types/environment";
import { TUser } from "@formbricks/types/user";

interface SummaryMetadataProps {
  environment: TEnvironment;
  survey: TSurvey;
  webAppUrl: string;
  product: TProduct;
  user: TUser;
  singleUseIds?: string[];
}

export default function SuccessMessage({
  environment,
  survey,
  webAppUrl,
  product,
  user,
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
        webAppUrl={webAppUrl}
        product={product}
        user={user}
      />
      {confetti && <Confetti />}
    </>
  );
}
