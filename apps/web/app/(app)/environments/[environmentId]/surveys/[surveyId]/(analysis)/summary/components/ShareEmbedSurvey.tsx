"use client";

import LinkSingleUseSurveyModal from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/LinkSingleUseSurveyModal";
import { ArrowLeftIcon, CodeBracketIcon, EnvelopeIcon, LinkIcon } from "@heroicons/react/24/outline";
import { DocumentDuplicateIcon } from "@heroicons/react/24/solid";
import { BellRing, BlocksIcon, Code2Icon } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import { cn } from "@formbricks/lib/cn";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";
import { TUser } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/Button";
import { Dialog, DialogContent } from "@formbricks/ui/Dialog";

import EmailTab from "./shareEmbedTabs/EmailTab";
import LinkTab from "./shareEmbedTabs/LinkTab";
import WebpageTab from "./shareEmbedTabs/WebpageTab";

interface ShareEmbedSurveyProps {
  survey: TSurvey;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  webAppUrl: string;
  product: TProduct;
  user: TUser;
}
export default function ShareEmbedSurvey({ survey, open, setOpen, webAppUrl, user }: ShareEmbedSurveyProps) {
  const environmentId = survey.environmentId;
  const surveyUrl = useMemo(() => webAppUrl + "/s/" + survey.id, [survey, webAppUrl]);
  const isSingleUseLinkSurvey = survey.singleUse?.enabled;
  const { email } = user;

  const tabs = [
    { id: "email", label: "Embed in an Email", icon: EnvelopeIcon },
    { id: "webpage", label: "Embed in a Web Page", icon: CodeBracketIcon },
    { id: "link", label: `${isSingleUseLinkSurvey ? "Single Use Links" : "Share the Link"}`, icon: LinkIcon },
  ];

  const [activeId, setActiveId] = useState(tabs[0].id);
  const [showInitialPage, setShowInitialPage] = useState(true);
  const linkTextRef = useRef(null);

  const handleTextSelection = () => {
    if (linkTextRef.current) {
      const range = document.createRange();
      range.selectNodeContents(linkTextRef.current);

      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  const handleOpenChange = (open: boolean) => {
    setActiveId(tabs[0].id);
    setOpen(open);
    setShowInitialPage(open); // Reset to initial page when modal opens
  };

  const handleInitialPageButton = () => {
    setShowInitialPage(!showInitialPage);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className=" w-full max-w-xl bg-white p-0 md:max-w-3xl lg:h-[700px] lg:max-w-5xl">
        {showInitialPage ? (
          <div className="h-full">
            <div className="flex h-[200px] flex-col items-center justify-center space-y-6 p-8 text-center lg:h-2/5">
              <p className="pt-2 text-xl font-semibold text-slate-800">Your survey is public 🎉</p>
              <div className="flex flex-col gap-2 lg:flex-row">
                <div
                  ref={linkTextRef}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-800"
                  onClick={() => handleTextSelection()}>
                  <span>{surveyUrl}</span>
                </div>
                <Button
                  variant="darkCTA"
                  className="inline"
                  title="Copy survey link to clipboard"
                  aria-label="Copy survey link to clipboard"
                  onClick={() => {
                    navigator.clipboard.writeText(surveyUrl);
                    toast.success("URL copied to clipboard!");
                  }}
                  EndIcon={DocumentDuplicateIcon}>
                  Copy Link
                </Button>
              </div>
            </div>
            <div className="flex h-[300px] flex-col items-center justify-center gap-8 rounded-b-lg bg-slate-50 px-8 lg:h-3/5">
              <p className="-mt-8 text-sm text-slate-500">What&apos;s next?</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleInitialPageButton}
                  className="flex flex-col items-center gap-3 rounded-lg border border-slate-100 bg-white p-4 text-sm  text-slate-500 hover:border-slate-200 md:p-8">
                  <Code2Icon className="h-6 w-6 text-slate-700" />
                  Embed survey
                </button>
                <Link
                  href={`/environments/${environmentId}//settings/notifications`}
                  className="flex flex-col items-center gap-3 rounded-lg border border-slate-100  bg-white p-4  text-sm text-slate-500 hover:border-slate-200 md:p-8">
                  <BellRing className="h-6 w-6 text-slate-700" />
                  Configure alerts
                </Link>
                <Link
                  href={`/environments/${environmentId}/integrations`}
                  className="flex flex-col items-center gap-3 rounded-lg border border-slate-100  bg-white  p-4 text-sm text-slate-500 hover:border-slate-200 md:p-8">
                  <BlocksIcon className="h-6 w-6 text-slate-700" />
                  Setup integrations
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-hidden">
            <div className="border-b border-slate-200 py-2">
              <Button
                variant="minimal"
                className="focus:ring-0"
                onClick={handleInitialPageButton}
                StartIcon={ArrowLeftIcon}>
                Back
              </Button>
            </div>
            <div className="grid h-full grid-cols-4">
              <div className="col-span-1 hidden flex-col gap-3 border-r border-slate-200 p-4 lg:flex">
                {tabs.map((tab) => (
                  <Button
                    StartIcon={tab.icon}
                    startIconClassName="h-4 w-4"
                    variant="minimal"
                    key={tab.id}
                    onClick={() => setActiveId(tab.id)}
                    className={cn(
                      "rounded-md border px-4 py-2 text-slate-600",
                      // "focus:ring-0 focus:ring-offset-0", // enable these classes to remove the focus rings on buttons
                      tab.id === activeId
                        ? "border-slate-200 bg-slate-100 font-semibold text-slate-900"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    )}
                    aria-current={tab.id === activeId ? "page" : undefined}>
                    {tab.label}
                  </Button>
                ))}
              </div>
              <div className="col-span-4 h-full bg-slate-50 px-4 py-6 lg:col-span-3 lg:p-6">
                <div className="">
                  {isSingleUseLinkSurvey ? (
                    <LinkSingleUseSurveyModal survey={survey} surveyBaseUrl={webAppUrl} />
                  ) : activeId === "email" ? (
                    <EmailTab surveyId={survey.id} email={email} />
                  ) : activeId === "webpage" ? (
                    <WebpageTab surveyUrl={surveyUrl} />
                  ) : activeId === "link" ? (
                    <LinkTab surveyUrl={surveyUrl} webAppUrl={webAppUrl} />
                  ) : null}
                </div>
                <div className="mt-2 rounded-md p-3 text-center lg:hidden">
                  {tabs.slice(0, 2).map((tab) => (
                    <Button
                      variant="minimal"
                      key={tab.id}
                      onClick={() => setActiveId(tab.id)}
                      className={cn(
                        "rounded-md px-4 py-2",
                        tab.id === activeId
                          ? "bg-white text-slate-900 shadow-sm"
                          : "border-transparent text-slate-700 hover:text-slate-900"
                      )}>
                      {tab.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
