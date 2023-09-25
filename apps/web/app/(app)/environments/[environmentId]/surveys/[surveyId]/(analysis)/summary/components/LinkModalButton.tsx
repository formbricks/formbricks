"use client";

import LinkSurveyModal from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/LinkSurveyModal";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { Button } from "@formbricks/ui";
import { ShareIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import clsx from "clsx";
import LinkSingleUseSurveyModal from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/LinkSingleUseSurveyModal";

interface LinkSurveyShareButtonProps {
  survey: TSurvey;
  className?: string;
  surveyBaseUrl: string;
  singleUseIds?: string[];
}

export default function LinkSurveyShareButton({
  survey,
  className,
  surveyBaseUrl,
  singleUseIds,
}: LinkSurveyShareButtonProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const isSingleUse = survey.singleUse?.enabled ?? false;

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
      {showLinkModal && isSingleUse && singleUseIds ? (
        <LinkSingleUseSurveyModal
          survey={survey}
          open={showLinkModal}
          setOpen={setShowLinkModal}
          singleUseIds={singleUseIds}
        />
      ) : (
        <LinkSurveyModal
          survey={survey}
          open={showLinkModal}
          setOpen={setShowLinkModal}
          surveyBaseUrl={surveyBaseUrl}
        />
      )}
    </>
  );
}
