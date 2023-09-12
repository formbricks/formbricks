"use client";

import { Button, Dialog, DialogContent } from "@formbricks/ui";
import { TSurvey } from "@formbricks/types/v1/surveys";
import {
  LinkIcon,
  EnvelopeIcon,
  CodeBracketIcon,
  DocumentDuplicateIcon,
  ArrowUpRightIcon,
} from "@heroicons/react/24/outline";
import { useMemo, useRef, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import CodeBlock from "@/components/shared/CodeBlock";
import { SURVEY_BASE_URL } from "@formbricks/lib/constants";
import toast from "react-hot-toast";

interface EmbedSurveyModalProps {
  survey: TSurvey;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const tabs = [
  { id: "link", label: "Share the Link", icon: LinkIcon },
  { id: "email", label: "Embed in an Email", icon: EnvelopeIcon },
  { id: "webpage", label: "Embed in a Web Page", icon: CodeBracketIcon },
];

export default function EmbedSurveyModal({ survey, open, setOpen }: EmbedSurveyModalProps) {
  const [activeId, setActiveId] = useState(tabs[0].id);
  const [showEmbed, setShowEmbed] = useState(false);

  const surveyUrl = useMemo(() => SURVEY_BASE_URL + survey.id, [survey]);

  const componentMap = {
    link: <LinkTab surveyUrl={surveyUrl} />,
    email: <EmailTab />,
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
                    "rounded-[4px] px-4 py-[6px] text-slate-600 focus:ring-0 focus:ring-offset-0",
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

const LinkTab = ({ surveyUrl }) => {
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
  return (
    <div className="flex grow flex-col gap-5">
      <div className="flex justify-between gap-2">
        <div
          ref={linkTextRef}
          className="relative grow overflow-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-slate-800"
          onClick={() => handleTextSelection()}>
          <span style={{ wordBreak: "break-all" }}>{surveyUrl}</span>
        </div>
        <Button
          variant="darkCTA"
          title="Copy survey link to clipboard"
          aria-label="Copy survey link to clipboard"
          onClick={() => {
            navigator.clipboard.writeText(surveyUrl);
            toast.success("URL copied to clipboard!");
          }}
          EndIcon={DocumentDuplicateIcon}>
          Copy URL
        </Button>
      </div>
      <div className="relative grow rounded-xl border border-gray-200 bg-white px-8 py-10">
        <Button
          variant="minimal"
          className={cn(
            "absolute bottom-6 left-1/2 -translate-x-1/2 transform rounded-lg border border-slate-200"
          )}
          EndIcon={ArrowUpRightIcon}
          title="Open survey in new tab"
          aria-label="Open survey in new tab"
          endIconClassName="h-4 w-4 ">
          Open in new tab
        </Button>
      </div>
    </div>
  );
};

const EmailTab = () => {
  return <>Email</>;
};

const WebpageTab = ({ surveyUrl }) => {
  const iframeCode = `<div style="position: relative; height:100vh; max-height:100vh; overflow:auto;"> 
  <iframe 
  src="${surveyUrl}" 
  frameborder="0" style="position: absolute; left:0; top:0; width:100%; height:100%; border:0;">
  </iframe>
  </div>`;

  return (
    <div className="flex grow flex-col gap-5">
      <div className="flex justify-between">
        <div className=""></div>
        <Button
          variant="darkCTA"
          title="Embed survey in your website"
          aria-label="Embed survey in your website"
          onClick={() => {
            navigator.clipboard.writeText(iframeCode);
            toast.success("Embed code copied to clipboard!");
          }}
          EndIcon={DocumentDuplicateIcon}>
          Copy code
        </Button>
      </div>
      <div className="grow rounded-xl border border-gray-200 bg-white px-8 py-10">
        {/* {iframeCode} */}

        {/* <CodeBlock
          customCodeClass="!whitespace-normal sm:!whitespace-pre-wrap !break-all sm:!break-normal bg-transparent"
          language="html">
          {iframeCode}
        </CodeBlock> */}
      </div>
    </div>
  );
};
