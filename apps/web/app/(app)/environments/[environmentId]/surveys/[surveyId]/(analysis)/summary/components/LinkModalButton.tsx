"use client";

import { TSurvey } from "@formbricks/types/v1/surveys";
import { Button } from "@formbricks/ui";
import { ShareIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import clsx from "clsx";
import { TProduct } from "@formbricks/types/v1/product";
import ShareEmbedSurvey from "./ShareEmbedSurvey";

interface LinkSurveyShareButtonProps {
  survey: TSurvey;
  className?: string;
  surveyBaseUrl: string;
  product: TProduct;
}

export default function LinkSurveyShareButton({
  survey,
  className,
  surveyBaseUrl,
  product,
}: LinkSurveyShareButtonProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        className={clsx(
          "border border-slate-300 bg-white px-2 hover:bg-slate-100 focus:bg-slate-100 lg:px-6",
          className
        )}
        onClick={() => setShowLinkModal(true)}>
        <ShareIcon className="h-5 w-5" />
      </Button>

      {showLinkModal && (
        <ShareEmbedSurvey
          survey={survey}
          open={showLinkModal}
          setOpen={setShowLinkModal}
          product={product}
          surveyBaseUrl={surveyBaseUrl}
        />
      )}
    </>
  );
}
