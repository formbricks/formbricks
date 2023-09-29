"use client";

import LinkTab from "./shareEmbedTabs/LinkTab";
import EmailTab from "./shareEmbedTabs/EmailTab";
import WebpageTab from "./shareEmbedTabs/WebpageTab";
import { useState } from "react";
import { Button, Dialog, DialogContent } from "@formbricks/ui";
import { LinkIcon, EnvelopeIcon, CodeBracketIcon } from "@heroicons/react/24/outline";
import { cn } from "@formbricks/lib/cn";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { TProduct } from "@formbricks/types/v1/product";
import { TProfile } from "@formbricks/types/v1/profile";

interface EmbedSurveyModalProps {
  survey: TSurvey;
  open: boolean;
  setOpen: (open: boolean) => void;
  surveyUrl: string;
  product: TProduct;
  profile: TProfile;
}

export default function EmbedSurveyModal({
  survey,
  open,
  setOpen,
  surveyUrl,
  product,
  profile,
}: EmbedSurveyModalProps) {
  const [activeId, setActiveId] = useState(tabs[0].id);

  const componentMap = {
    link: <LinkTab surveyUrl={surveyUrl} survey={survey} product={product} />,
    email: <EmailTab survey={survey} surveyUrl={surveyUrl} profile={profile} product={product} />,
    webpage: <WebpageTab surveyUrl={surveyUrl} />,
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[960px] gap-0 overflow-hidden bg-white p-0 sm:max-w-[auto]">
        <div className="border-b border-gray-200 px-6 py-4 ">Share or embed your survey</div>
        <div className="flex">
          <div className="shrink-0 basis-[326px] border-r border-gray-200 px-6 py-8">
            <div className="flex w-max flex-col gap-3">
              {tabs.map((tab) => (
                <Button
                  StartIcon={tab.icon}
                  startIconClassName={cn("h-4 w-4")}
                  variant="minimal"
                  key={tab.id}
                  onClick={() => setActiveId(tab.id)}
                  className={cn(
                    "rounded-[4px] px-4 py-[6px] text-slate-600",
                    // "focus:ring-0 focus:ring-offset-0", // enable these classes to remove the focus rings on buttons
                    tab.id === activeId
                      ? " border border-gray-200 bg-slate-100 font-semibold text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  )}
                  aria-current={tab.id === activeId ? "page" : undefined}>
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex h-[590px] grow bg-gray-50 p-6">{componentMap[activeId]}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const tabs = [
  { id: "link", label: "Share the Link", icon: LinkIcon },
  { id: "email", label: "Embed in an Email", icon: EnvelopeIcon },
  { id: "webpage", label: "Embed in a Web Page", icon: CodeBracketIcon },
];
