"use client";

import LinkSurveyModal from "@/app/environments/[environmentId]/surveys/[surveyId]/summary/LinkSurveyModal";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { Button } from "@formbricks/ui";
import { ShareIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

interface LinkSurveyShareButtonProps {
  survey: TSurvey;
}

export default function LinkSurveyShareButton({ survey }: LinkSurveyShareButtonProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        className="h-full border border-slate-300 bg-white px-2 hover:bg-slate-100 focus:bg-slate-100 lg:px-6"
        onClick={() => setShowLinkModal(true)}>
        <ShareIcon className="h-5 w-5" />
      </Button>
      {showLinkModal && <LinkSurveyModal survey={survey} open={showLinkModal} setOpen={setShowLinkModal} />}
    </>
  );
}
