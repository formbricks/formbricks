"use client";

import {
  deleteResultShareUrlAction,
  generateResultShareUrlAction,
  getResultShareUrlAction,
} from "@/app/(app)/environments/[environmentId]/engagements/[surveyId]/(analysis)/summary/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { useTranslate } from "@tolgee/react";
import { CopyIcon, DownloadIcon, GlobeIcon, LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ShareSurveyResults } from "../(analysis)/summary/components/ShareSurveyResults";

interface ResultsShareButtonProps {
  survey: TSurvey;
  webAppUrl: string;
}

export const ResultsShareButton = ({ survey, webAppUrl }: ResultsShareButtonProps) => {
  const { t } = useTranslate();
  const [showResultsLinkModal, setShowResultsLinkModal] = useState(false);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [surveyUrl, setSurveyUrl] = useState("");

  const handlePublish = async () => {
    const resultShareKeyResponse = await generateResultShareUrlAction({ surveyId: survey.id });
    if (resultShareKeyResponse?.data) {
      setSurveyUrl(webAppUrl + "/share/" + resultShareKeyResponse.data);
      setShowPublishModal(true);
    } else {
      const errorMessage = getFormattedErrorMessage(resultShareKeyResponse);
      toast.error(errorMessage);
    }
  };

  const handleUnpublish = () => {
    deleteResultShareUrlAction({ surveyId: survey.id }).then((deleteResultShareUrlResponse) => {
      if (deleteResultShareUrlResponse?.data) {
        toast.success(t("environments.surveys.results_unpublished_successfully"));
        setShowPublishModal(false);
      } else {
        const errorMessage = getFormattedErrorMessage(deleteResultShareUrlResponse);
        toast.error(errorMessage);
      }
    });
  };

  useEffect(() => {
    const fetchSharingKey = async () => {
      const resultShareUrlResponse = await getResultShareUrlAction({ surveyId: survey.id });
      if (resultShareUrlResponse?.data) {
        setSurveyUrl(webAppUrl + "/share/" + resultShareUrlResponse.data);
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
          toast.success(t("common.copied_to_clipboard"));
        })
        .catch(() => {
          toast.error(t("environments.surveys.failed_to_copy_link_to_results"));
        });
    } else {
      toast.error(t("environments.surveys.failed_to_copy_url"));
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
              <span className="text-sm text-slate-700">
                {t("environments.surveys.summary.share_results")}
              </span>
              <LinkIcon className="ml-2 h-4 w-4" />
            </div>
            <DownloadIcon className="block h-4 sm:hidden" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {survey.resultShareKey ? (
            <DropdownMenuItem
              onClick={() => {
                navigator.clipboard.writeText(surveyUrl);
                toast.success(t("environments.surveys.summary.link_to_public_results_copied"));
              }}
              icon={<CopyIcon className="ml-1.5 inline h-4 w-4" />}>
              <p className="text-slate-700">
                {t("environments.surveys.summary.copy_link_to_public_results")}
              </p>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => {
                copyUrlToClipboard();
              }}
              icon={<CopyIcon className="ml-1.5 h-4 w-4" />}>
              <p className="flex items-center text-slate-700">{t("common.copy_link")}</p>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => {
              setShowResultsLinkModal(true);
            }}
            icon={<GlobeIcon className="ml-1.5 h-4 w-4" />}>
            <p className="flex items-center text-slate-700">
              {survey.resultShareKey
                ? t("environments.surveys.summary.unpublish_from_web")
                : t("environments.surveys.summary.publish_to_web")}
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
