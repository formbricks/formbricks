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
import {
  generateResponseSharingKeyAction,
  getResponseSharingKeyAction,
  deleteResponseSharingKeyAction,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/actions";
import { useEffect } from "react";
import toast from "react-hot-toast";

interface LinkSurveyShareButtonProps {
  survey: TSurvey;
  className?: string;
  webAppUrl: string;
  product: TProduct;
  profile: TProfile;
}

export default function LinkSurveyShareButton({
  survey,
  className,
  webAppUrl,
  product,
  profile,
}: LinkSurveyShareButtonProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showResultsLinkModal, setShowResultsLinkModal] = useState(false);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [surveyUrl, setSurveyUrl] = useState("");
  // console.log("+++++",generateResponseSharingKeyAction(survey.id))

  const handlePublish = async () => {
    const key = await generateResponseSharingKeyAction(survey.id);
    setSurveyUrl(webAppUrl + "/share/" + key);
    setShowPublishModal(true);
  };

  const handleUnpublish = () => {
    deleteResponseSharingKeyAction(survey.id)
      .then(() => {
        toast.success("Survey Unpublished successfully");
        setShowPublishModal(false);
      })
      .catch((error) => {
        toast.error(`Error: ${error.message}`);
      });
  };

  useEffect(() => {
    async function fetchSharingKey() {
      const sharingKey = await getResponseSharingKeyAction(survey.id);
      if (sharingKey) {
        setSurveyUrl(webAppUrl + "/share/" + sharingKey);
        setShowPublishModal(true);
      }
    }

    fetchSharingKey();
  }, [survey.id, webAppUrl]);

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
          webAppUrl={webAppUrl}
          profile={profile}
        />
      )}
      {showResultsLinkModal && (
        <ShareSurveyResults
          open={showResultsLinkModal}
          setOpen={setShowResultsLinkModal}
          surveyUrl={surveyUrl}
          handlePublish={handlePublish}
          handleUnpublish={handleUnpublish}
          showPublishModal={showPublishModal}
        />
      )}
    </>
  );
}
