"use client";

import {
  deleteResultShareUrlAction,
  generateResultShareUrlAction,
  getResultShareUrlAction,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/actions";
import { CopyIcon, DownloadIcon, GlobeIcon, LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { ShareSurveyResults } from "../(analysis)/summary/components/ShareSurveyResults";

interface ResultsShareButtonProps {
  survey: TSurvey;
  webAppUrl: string;
}

export const ResultsShareButton = ({ survey, webAppUrl }: ResultsShareButtonProps) => {
  const [showResultsLinkModal, setShowResultsLinkModal] = useState(false);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [surveyUrl, setSurveyUrl] = useState("");

  const handlePublish = async () => {
    const key = await generateResultShareUrlAction(survey.id);
    setSurveyUrl(webAppUrl + "/share/" + key);
    setShowPublishModal(true);
  };

  const handleUnpublish = () => {
    deleteResultShareUrlAction(survey.id)
      .then(() => {
        toast.success("Results unpublished successfully.");
        setShowPublishModal(false);
      })
      .catch((error) => {
        toast.error(`Error: ${error.message}`);
      });
  };

  useEffect(() => {
    const fetchSharingKey = async () => {
      const sharingKey = await getResultShareUrlAction(survey.id);
      if (sharingKey) {
        setSurveyUrl(webAppUrl + "/share/" + sharingKey);
        setShowPublishModal(true);
      }
    };

    fetchSharingKey();
  }, [survey.id, webAppUrl]);

  const copyUrlToClipboard = () => {
    if (typeof window !== "undefined") {
      const currentUrl = window.location.href;
      navigator.clipboard
        .writeText(currentUrl)
        .then(() => {
          toast.success("Link to results copied to clipboard.");
        })
        .catch((err) => {
          console.error("Failed to copy: ", err);
          toast.error("Failed to copy link to results to clipboard.");
        });
    } else {
      console.error("Cannot copy URL: not running in a browser environment.");
      toast.error("Failed to copy URL: not in a browser environment.");
    }
  };
  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger
          asChild
          className="focus:bg-muted cursor-pointer border border-slate-200 outline-none hover:border-slate-300">
          <div className="min-w-auto h-auto rounded-md border bg-white p-3 sm:flex sm:min-w-[7rem] sm:px-6 sm:py-3">
            <div className="hidden w-full items-center justify-between sm:flex">
              <span className="text-sm text-slate-700">Share results</span>
              <LinkIcon className="ml-2 h-4 w-4" />
            </div>
            <DownloadIcon className="block h-4 sm:hidden" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {survey.resultShareKey ? (
            <DropdownMenuItem
              className="hover:ring-0"
              onClick={() => {
                navigator.clipboard.writeText(surveyUrl);
                toast.success("Link to public results copied");
              }}>
              <p className="text-slate-700">
                Copy link to public results <CopyIcon className="ml-1.5 inline h-4 w-4" />
              </p>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="text-slate-700 hover:ring-0"
              onClick={() => {
                copyUrlToClipboard();
              }}>
              <p className="flex items-center text-slate-700">
                Copy link <CopyIcon className="ml-1.5 h-4 w-4" />
              </p>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="hover:ring-0"
            onClick={() => {
              setShowResultsLinkModal(true);
            }}>
            <p className="flex items-center text-slate-700">
              {survey.resultShareKey ? "Unpublish from web" : "Publish to web"}
              <GlobeIcon className="ml-1.5 h-4 w-4" />
            </p>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
    </div>
  );
};
