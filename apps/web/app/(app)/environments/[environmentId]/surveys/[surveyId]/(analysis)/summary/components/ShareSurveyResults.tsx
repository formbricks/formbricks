"use client";

import { useMemo, useState, useRef } from "react";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";
import { DialogContent, Dialog } from "@formbricks/ui/Dialog";
import { Button } from "@formbricks/ui/Button";
import { LinkIcon, EnvelopeIcon, CodeBracketIcon } from "@heroicons/react/24/outline";
import { TProfile } from "@formbricks/types/profile";
import { GlobeEuropeAfricaIcon, CheckCircleIcon } from "@heroicons/react/24/solid";
// import { WEBAPP_URL } from "@formbricks/lib/constants";
import toast from "react-hot-toast";
import { DocumentDuplicateIcon } from "@heroicons/react/24/solid";
// import { generateResponseSharingKeyAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/actions";

interface ShareEmbedSurveyProps {
  survey: TSurvey;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  surveyBaseUrl: string;
  product: TProduct;
  profile: TProfile;
}
export default function ShareSurveyResults({
  survey,
  open,
  setOpen,
  surveyBaseUrl,
  product,
  profile,
}: ShareEmbedSurveyProps) {
  const surveyUrl = useMemo(() => surveyBaseUrl + survey.id, [survey]);
  const isSingleUseLinkSurvey = survey.singleUse?.enabled;
  const { email } = profile;
  const { brandColor } = product;
  const surveyBrandColor = survey.productOverwrites?.brandColor || brandColor;

  const tabs = [
    { id: "link", label: `${isSingleUseLinkSurvey ? "Single Use Links" : "Share the Link"}`, icon: LinkIcon },
    { id: "email", label: "Embed in an Email", icon: EnvelopeIcon },
    { id: "webpage", label: "Embed in a Web Page", icon: CodeBracketIcon },
  ];

  const [showLinkModal, setShowLinkModal] = useState(false);
  //   console.log("+++++",generateResponseSharingKeyAction(survey.id))
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
      }}>
      {showLinkModal ? (
        <DialogContent className="bottom-0 flex h-[95%] w-full flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 sm:max-w-none lg:bottom-auto lg:h-auto lg:w-[40%]">
          <div className="mt-4 flex grow flex-col items-center justify-center overflow-x-hidden overflow-y-scroll">
            <CheckCircleIcon className="mt-4 h-20 w-20 text-slate-300" />
            <div className=" mt-6 px-4 py-3 text-lg font-medium text-slate-600 lg:px-6 lg:py-3">
              Page is live on the web.
            </div>

            <div
              // ref={linkTextRef}
              className="relative grow overflow-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
              // onClick={() => handleTextSelection()}
            >
              <span
                style={{
                  wordBreak: "break-all",
                }}>{`https://anjy7-formbricks-rm8qcmypjuj.ws-us105.gitpod.io/share/clnlkubyc0009kemnt1qwxnia`}</span>
            </div>
            <div className="my-6 flex gap-2">
              <Button
                type="submit"
                variant="highlight"
                className=" text-center"
                onClick={() => setShowLinkModal(true)}>
                Unpublish
              </Button>

              <Button
                variant="darkCTA"
                className=" text-center"
                href={"guide.href"}
                onClick={() => setShowLinkModal(true)}>
                View Site
              </Button>
            </div>
          </div>
        </DialogContent>
      ) : (
        <DialogContent className="bottom-0 flex h-[95%] w-full flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 sm:max-w-none lg:bottom-auto lg:h-auto lg:w-[40%]">
          <div className="mt-4 flex grow flex-col items-center justify-center overflow-x-hidden overflow-y-scroll">
            <GlobeEuropeAfricaIcon className="mt-4 h-20 w-20 text-slate-300" />
            <div className=" mt-6 px-4 py-3 text-lg font-medium text-slate-600 lg:px-6 lg:py-3">
              Publish Results to web
            </div>
            <div className="text-md px-4  py-3 text-slate-500 lg:px-6 lg:py-0 ">
              Share survey results with anyone who has link.
            </div>
            <div className=" text-md px-4  py-3 text-slate-500  lg:px-6 lg:py-0 ">
              The Results will not be indexed by search engines.
            </div>
            <Button
              type="submit"
              variant="darkCTA"
              className="my-8  h-full text-center"
              onClick={() => setShowLinkModal(true)}>
              Publish to web
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
