"use client";

import { TSurvey } from "@formbricks/types/surveys";
import { LinkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { TProduct } from "@formbricks/types/product";
import ShareEmbedSurvey from "./ShareEmbedSurvey";
import ShareSurveyResults from "./ShareSurveyResults";
import { TProfile } from "@formbricks/types/profile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { DownloadIcon } from "lucide-react";

interface LinkSurveyShareButtonProps {
  survey: TSurvey;
  className?: string;
  surveyBaseUrl: string;
  product: TProduct;
  profile: TProfile;
}

export default function LinkSurveyShareButton({
  survey,
  className,
  surveyBaseUrl,
  product,
  profile,
}: LinkSurveyShareButtonProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showResultsLinkModal, setShowResultsLinkModal] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          asChild
          className="focus:bg-muted cursor-pointer border border-slate-300 outline-none">
          <div className="min-w-auto h-auto rounded-md border bg-white p-3 sm:flex sm:min-w-[7rem] sm:px-6 sm:py-3">
            <div className="hidden w-full items-center justify-between sm:flex">
              <span className="text-sm text-slate-700"> Share</span>
              <LinkIcon className="h-4 w-4" />
            </div>
            <DownloadIcon className="block h-4 sm:hidden" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            className="hover:ring-0"
            onClick={() => {
              setShowLinkModal(true);
            }}>
            <p className="text-slate-700">Share Survey</p>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="hover:ring-0"
            onClick={() => {
              setShowResultsLinkModal(true);
            }}>
            <p className="text-slate-700">Publish Results</p>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {showLinkModal && (
        <ShareEmbedSurvey
          survey={survey}
          open={showLinkModal}
          setOpen={setShowLinkModal}
          product={product}
          surveyBaseUrl={surveyBaseUrl}
          profile={profile}
        />
      )}
      {showResultsLinkModal && (
        <ShareSurveyResults
          survey={survey}
          open={showResultsLinkModal}
          setOpen={setShowResultsLinkModal}
          product={product}
          surveyBaseUrl={surveyBaseUrl}
          profile={profile}
        />
      )}
    </>
  );
}
