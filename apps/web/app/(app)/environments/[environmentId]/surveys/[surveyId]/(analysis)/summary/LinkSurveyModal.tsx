"use client";

import CodeBlock from "@/components/shared/CodeBlock";
import Modal from "@/components/shared/Modal";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { Button } from "@formbricks/ui";
import { CheckIcon } from "@heroicons/react/24/outline";
import { CodeBracketIcon, DocumentDuplicateIcon, EyeIcon } from "@heroicons/react/24/solid";
import { useRef, useState } from "react";
import toast from "react-hot-toast";

interface LinkSurveyModalProps {
  survey: TSurvey;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function LinkSurveyModal({ survey, open, setOpen }: LinkSurveyModalProps) {
  const linkTextRef = useRef(null);
  const [showEmbed, setShowEmbed] = useState(false);

  const iframeCode = `<div style="position: relative; height:100vh; max-height:100vh; 
overflow:auto;"> 
<iframe 
src="${window.location.protocol}//${window.location.host}/s/${survey.id}" 
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
    <Modal open={open} setOpen={setOpen} blur={false}>
      <div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100">
          <CheckIcon className="h-6 w-6 text-teal-600" aria-hidden="true" />
        </div>
        <div className="mt-3 text-center sm:mt-5">
          <h3 className="text-lg font-semibold leading-6 text-gray-900">Your survey is ready!</h3>
          {showEmbed ? (
            <div className="mt-4">
              <p className="text-sm text-gray-500">Embed survey on your website:</p>
              <CodeBlock language="html">{iframeCode}</CodeBlock>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-gray-500">Share this link to let people answer your survey:</p>
              <p
                ref={linkTextRef}
                className="relative mt-3 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-center text-slate-800"
                onClick={() => handleTextSelection()}>
                {`${window.location.protocol}//${window.location.host}/s/${survey.id}`}
              </p>
            </div>
          )}
          <div className="mt-4 flex justify-end space-x-2">
            <Button
              variant="secondary"
              title="Embed survey in your website"
              aria-label="Embed survey in your website"
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
                navigator.clipboard.writeText(
                  `${window.location.protocol}//${window.location.host}/s/${survey.id}`
                );
                toast.success("URL copied to clipboard!");
              }}
              title="Copy survey link to clipboard"
              aria-label="Copy survey link to clipboard"
              EndIcon={DocumentDuplicateIcon}>
              Copy URL
            </Button>
            <Button
              variant="darkCTA"
              title="Preview survey"
              aria-label="Preview survey"
              href={`${window.location.protocol}//${window.location.host}/s/${survey.id}?preview=true`}
              target="_blank"
              EndIcon={EyeIcon}>
              Preview
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
