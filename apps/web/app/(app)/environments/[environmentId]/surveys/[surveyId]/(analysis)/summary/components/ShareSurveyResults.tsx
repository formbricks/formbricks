"use client";

import { CheckCircleIcon, GlobeEuropeAfricaIcon } from "@heroicons/react/24/solid";
import { Clipboard } from "lucide-react";
import { toast } from "react-hot-toast";

import { Button } from "@formbricks/ui/Button";
import { Dialog, DialogContent } from "@formbricks/ui/Dialog";

interface ShareEmbedSurveyProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handlePublish: () => void;
  handleUnpublish: () => void;
  showPublishModal: boolean;
  surveyUrl: string;
}
export default function ShareSurveyResults({
  open,
  setOpen,
  handlePublish,
  handleUnpublish,
  showPublishModal,
  surveyUrl,
}: ShareEmbedSurveyProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
      }}>
      {showPublishModal && surveyUrl ? (
        <DialogContent className="bottom-0 flex h-[95%] w-full flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 sm:max-w-none lg:bottom-auto lg:h-auto lg:w-[40%]">
          <div className="no-scrollbar mt-4 flex grow flex-col items-center justify-center overflow-x-hidden overflow-y-scroll">
            <CheckCircleIcon className="mt-4 h-20 w-20 text-slate-300" />
            <div className="mt-6 px-4 py-3 text-lg font-medium text-slate-600 lg:px-6 lg:py-3">
              Your survey results are public on the web.
            </div>

            <div className="flex gap-2">
              <div className="relative grow overflow-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800">
                <span
                  style={{
                    wordBreak: "break-all",
                  }}>
                  {surveyUrl}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                title="Copy survey link to clipboard"
                aria-label="Copy survey link to clipboard"
                onClick={() => {
                  navigator.clipboard.writeText(surveyUrl);
                  toast.success("URL copied to clipboard!");
                }}>
                <Clipboard />
              </Button>
            </div>

            <div className="my-6 flex gap-2">
              <Button
                type="submit"
                variant="secondary"
                className=" text-center"
                onClick={() => handleUnpublish()}>
                Unpublish
              </Button>

              <Button variant="darkCTA" className=" text-center" href={surveyUrl} target="_blank">
                View Site
              </Button>
            </div>
          </div>
        </DialogContent>
      ) : (
        <DialogContent className="bottom-0 flex h-[95%] w-full flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 sm:max-w-none lg:bottom-auto lg:h-auto lg:w-[40%]">
          <div className="no-scrollbar mt-4 flex grow flex-col items-center justify-center overflow-x-hidden overflow-y-scroll">
            <GlobeEuropeAfricaIcon className="mt-4 h-20 w-20 text-slate-300" />
            <div className=" mt-6 px-4 py-3 text-lg font-medium text-slate-600 lg:px-6 lg:py-3">
              Publish Results to web
            </div>
            <div className="text-md px-4  py-3 text-slate-500 lg:px-6 lg:py-0 ">
              Share survey results with anyone who has the link.
            </div>
            <div className=" text-md px-4  py-3 text-slate-500  lg:px-6 lg:py-0 ">
              The results will not be indexed by search engines.
            </div>
            <Button
              type="submit"
              variant="darkCTA"
              className="my-8  h-full text-center"
              onClick={() => handlePublish()}>
              Publish to web
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
