"use client";

import { Button } from "@/modules/ui/components/button";
import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Clipboard } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";

interface ShareEmbedSurveyProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handlePublish: () => void;
  handleUnpublish: () => void;
  showPublishModal: boolean;
  surveyUrl: string;
}
export const ShareSurveyResults = ({
  open,
  setOpen,
  handlePublish,
  handleUnpublish,
  showPublishModal,
  surveyUrl,
}: ShareEmbedSurveyProps) => {
  const { t } = useTranslate();
  return (
    <Modal open={open} setOpen={setOpen} size="lg">
      {showPublishModal && surveyUrl ? (
        <div className="flex flex-col rounded-2xl bg-white px-12 py-6">
          <div className="flex flex-col items-center gap-y-6 text-center">
            <CheckCircle2Icon className="h-20 w-20 text-slate-300" />
            <div>
              <p className="text-lg font-medium text-slate-600">
                {t("environments.surveys.summary.survey_results_are_public")}
              </p>
              <p className="text-balanced mt-2 text-sm text-slate-500">
                {t("environments.surveys.summary.survey_results_are_shared_with_anyone_who_has_the_link")}
              </p>
            </div>
            <div className="flex gap-2">
              <div className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800">
                <span>{surveyUrl}</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                title="Copy survey link to clipboard"
                aria-label="Copy survey link to clipboard"
                className="hover:cursor-pointer"
                onClick={() => {
                  navigator.clipboard.writeText(surveyUrl);
                  toast.success(t("common.link_copied"));
                }}>
                <Clipboard />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="secondary"
                className="text-center"
                onClick={() => handleUnpublish()}>
                {t("environments.surveys.summary.unpublish_from_web")}
              </Button>
              <Button className="text-center" asChild>
                <Link href={surveyUrl} target="_blank" rel="noopener noreferrer">
                  {t("environments.surveys.summary.view_site")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col rounded-2xl bg-white p-8">
          <div className="flex flex-col items-center gap-y-6 text-center">
            <AlertCircleIcon className="h-20 w-20 text-slate-300" />
            <div>
              <p className="text-lg font-medium text-slate-600">
                {t("environments.surveys.summary.publish_to_web_warning")}
              </p>
              <p className="text-balanced mt-2 text-sm text-slate-500">
                {t("environments.surveys.summary.publish_to_web_warning_description")}
              </p>
            </div>
            <Button type="submit" className="h-full text-center" onClick={() => handlePublish()}>
              {t("environments.surveys.summary.publish_to_web")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
