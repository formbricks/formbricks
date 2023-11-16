"use client";

import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { TSurvey } from "@formbricks/types/surveys";
import { AuthenticationError } from "@formbricks/types/errors";
import { sendEmailAction } from "../../actions";
import CodeBlock from "@formbricks/ui/CodeBlock";
import { CodeBracketIcon, DocumentDuplicateIcon, EnvelopeIcon } from "@heroicons/react/24/solid";
import { use, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { getEmailValues } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedTabs/form";
import LoadingSpinner from "@formbricks/ui/LoadingSpinner";

interface EmailTabProps {
  survey: TSurvey;
  surveyUrl: string;
  email: string;
  brandColor: string;
}

export default function EmailTab({ survey, surveyUrl, email, brandColor }: EmailTabProps) {
  const [showEmbed, setShowEmbed] = useState(false);
  const subject = "Formbricks Email Survey Preview";
  const [loading, setloading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setloading(false);
    }, 500);
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  const emailValues = getEmailValues({ survey, surveyUrl, brandColor, preview: true });

  const previewEmailValues = getEmailValues({ survey, surveyUrl, brandColor, preview: true });

  const sendPreviewEmail = () => {
    try {
      sendEmailAction({ html: previewEmailValues.html, subject, to: email });
      toast.success("Email sent!");
    } catch (err) {
      if (err instanceof AuthenticationError) {
        toast.error("You are not authenticated to perform this action.");
        return;
      }

      toast.error("Something went wrong. Please try again later.");
    }
  };

  return (
    <div className="flex h-full grow flex-col gap-5">
      <div className="flex items-center justify-end gap-4">
        {showEmbed ? (
          <Button
            variant="darkCTA"
            title="Embed survey in your website"
            aria-label="Embed survey in your website"
            onClick={() => {
              toast.success("Embed code copied to clipboard!");
              navigator.clipboard.writeText(emailValues.html);
            }}
            className="shrink-0"
            EndIcon={DocumentDuplicateIcon}>
            Copy code
          </Button>
        ) : (
          <>
            <Input
              type="email"
              placeholder="user@mail.com"
              className="h-11 grow bg-white"
              value={email}
              readOnly={true}
            />
            <Button
              variant="secondary"
              title="send preview email"
              aria-label="send preview email"
              onClick={sendPreviewEmail}
              EndIcon={EnvelopeIcon}
              className="shrink-0">
              Send Preview
            </Button>
          </>
        )}
        <Button
          variant="darkCTA"
          title="view embed code for email"
          aria-label="view embed code for email"
          onClick={() => setShowEmbed(!showEmbed)}
          EndIcon={CodeBracketIcon}
          className="shrink-0">
          {showEmbed ? "Hide Embed Code" : "View Embed Code"}
        </Button>
      </div>
      <div className="grow overflow-y-scroll rounded-xl border border-gray-200 bg-white px-4 py-[18px]">
        {showEmbed ? (
          <CodeBlock
            customCodeClass="!whitespace-normal sm:!whitespace-pre-wrap !break-all sm:!break-normal"
            language="html"
            showCopyToClipboard={false}>
            {emailValues.html}
          </CodeBlock>
        ) : (
          <div className="">
            <div className="mb-6 flex gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500"></div>
              <div className="h-3 w-3 rounded-full bg-amber-500"></div>
              <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
            </div>
            <div className="">
              <div className="mb-2 border-b border-slate-200 pb-2 text-sm">
                To : {email || "user@mail.com"}
              </div>
              <div className="border-b border-slate-200 pb-2 text-sm">Subject : {subject}</div>
              <div className="p-4">{previewEmailValues.Component}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
