"use client";

import CodeBlock from "@/components/shared/CodeBlock";
import { SURVEY_BASE_URL } from "@formbricks/lib/constants";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { Button, Dialog, DialogContent } from "@formbricks/ui";
import { CheckIcon } from "@heroicons/react/24/outline";
import { CodeBracketIcon, DocumentDuplicateIcon, EyeIcon } from "@heroicons/react/24/solid";
import { useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

interface LinkSurveyModalProps {
  survey: TSurvey;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function LinkSurveyModal({ survey, open, setOpen }: LinkSurveyModalProps) {
  const linkTextRef = useRef(null);
  const [showEmbed, setShowEmbed] = useState(false);

  const surveyUrl = useMemo(() => SURVEY_BASE_URL + survey.id, [survey]);

  const iframeCode = `<div style="position: relative; height:100vh; max-height:100vh; 
overflow:auto;"> 
<iframe 
src="${surveyUrl}" 
frameborder="0" style="position: absolute; left:0;
top:0; width:100%; height:100%; border:0;">
</iframe></div>`;
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bottom-0 max-w-sm bg-white p-4 sm:bottom-auto sm:max-w-xl sm:p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100">
          <CheckIcon className="h-6 w-6 text-teal-600" aria-hidden="true" />
        </div>
        <div className="mt-3 text-center sm:mt-5">
          <h3 className="text-lg font-semibold leading-6 text-gray-900">Your survey is ready!</h3>
          {showEmbed ? (
            <div className="mt-4">
              <p className="text-sm text-gray-500">Embed survey on your website:</p>
              <CodeBlock
                customCodeClass="!whitespace-normal sm:!whitespace-pre-wrap !break-all sm:!break-normal"
                language="html">
                {iframeCode}
              </CodeBlock>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-gray-500">Share this link to let people answer your survey:</p>
              <div
                ref={linkTextRef}
                className="relative mt-3 max-w-full overflow-auto rounded-lg border border-slate-300 bg-slate-50 p-3 text-center text-slate-800"
                onClick={() => handleTextSelection()}>
                <span
                  style={{
                    wordBreak: "break-all",
                  }}>
                  {surveyUrl}
                </span>
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              title="Embed survey in your website"
              aria-label="Embed survey in your website"
              className="flex justify-center"
              onClick={() => {
                setShowEmbed(true);
                navigator.clipboard.writeText(iframeCode);
                toast.success("iframe code copied to clipboard!");
              }}
              EndIcon={CodeBracketIcon}>
              Embed
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowEmbed(false);
                navigator.clipboard.writeText(surveyUrl);
                toast.success("URL copied to clipboard!");
              }}
              title="Copy survey link to clipboard"
              aria-label="Copy survey link to clipboard"
              className="flex justify-center"
              EndIcon={DocumentDuplicateIcon}>
              Copy URL
            </Button>
            <Button
              variant="darkCTA"
              title="Preview survey"
              aria-label="Preview survey"
              className="flex justify-center"
              href={`${surveyUrl}?preview=true`}
              target="_blank"
              EndIcon={EyeIcon}>
              Preview
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
