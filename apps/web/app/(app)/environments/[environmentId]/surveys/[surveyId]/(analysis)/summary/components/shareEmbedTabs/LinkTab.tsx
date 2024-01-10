"use client";

import { DocumentDuplicateIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { useRef } from "react";
import toast from "react-hot-toast";

import { TSurvey } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";

interface EmailTabProps {
  surveyUrl: string;
  survey: TSurvey;
  brandColor: string;
}

export default function LinkTab({ surveyUrl, survey, brandColor }: EmailTabProps) {
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

  const docsLinks = [
    {
      title: "Identify users",
      description: "You have the email address or a userId? Append it to the URL.",
      link: "https://formbricks.com/docs/link-surveys/user-identification",
    },
    {
      title: "Data prefilling",
      description: "You want to prefill some fields in the survey? Here is how.",
      link: "https://formbricks.com/docs/link-surveys/data-prefilling",
    },
    {
      title: "Source tracking",
      description: "Run GDPR & CCPA compliant source tracking without extra tools.",
      link: "https://formbricks.com/docs/link-surveys/source-tracking",
    },
    {
      title: "Create single-use links",
      description: "Accept only one submission per link. Here is how.",
      link: "https://formbricks.com/docs/link-surveys/single-use-links",
    },
  ];

  return (
    <div className="flex h-full grow flex-col gap-8">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="pt-2 text-lg font-semibold text-slate-800">Share the link to get responses:</p>
        <div
          ref={linkTextRef}
          className="relative grow overflow-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
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
      <div className="flex flex-wrap justify-between gap-2">
        <p className="pt-2 font-semibold text-slate-800">You can do a lot more with links surveys</p>
        <div className="grid grid-cols-2 gap-2">
          {docsLinks.map((tip) => (
            <Link
              target="_blank"
              href={tip.link}
              className="relative w-full rounded-md border border-slate-100 bg-white px-6 py-4 text-sm text-slate-600 hover:bg-slate-50">
              <p className="mb-1 font-semibold">{tip.title}</p>
              <p className="text-slate-500">{tip.description}</p>
            </Link>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <p className="pt-2 font-semibold text-slate-800">Link URL got too long? Shorten it!</p>
        <div
          ref={linkTextRef}
          className="relative grow overflow-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
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
    </div>
  );
}
