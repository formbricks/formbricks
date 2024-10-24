"use client";

import { Code2Icon, CopyIcon, MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AuthenticationError } from "@formbricks/types/errors";
import { Button } from "@formbricks/ui/components/Button";
import { CodeBlock } from "@formbricks/ui/components/CodeBlock";
import { LoadingSpinner } from "@formbricks/ui/components/LoadingSpinner";
import { getEmailHtmlAction, sendEmbedSurveyPreviewEmailAction } from "../../actions";

interface EmailTabProps {
  surveyId: string;
  email: string;
}

export const EmailTab = ({ surveyId, email }: EmailTabProps) => {
  const [showEmbed, setShowEmbed] = useState(false);
  const [emailHtmlPreview, setEmailHtmlPreview] = useState<string>("");
  const t = useTranslations();
  const emailHtml = useMemo(() => {
    if (!emailHtmlPreview) return "";
    return emailHtmlPreview
      .replaceAll("?preview=true&amp;", "?")
      .replaceAll("?preview=true&;", "?")
      .replaceAll("?preview=true", "");
  }, [emailHtmlPreview]);

  useEffect(() => {
    const getData = async () => {
      const emailHtml = await getEmailHtmlAction({ surveyId });
      setEmailHtmlPreview(emailHtml?.data || "");
    };

    getData();
  }, [surveyId]);

  const sendPreviewEmail = async () => {
    try {
      await sendEmbedSurveyPreviewEmailAction({ surveyId });
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
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-end gap-4">
        {showEmbed ? (
          <Button
            variant="secondary"
            title="Embed survey in your website"
            aria-label="Embed survey in your website"
            onClick={() => {
              toast.success("Embed code copied to clipboard!");
              navigator.clipboard.writeText(emailHtml);
            }}
            className="shrink-0"
            EndIcon={CopyIcon}>
            {t("common.copy_code")}
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              title="send preview email"
              aria-label="send preview email"
              onClick={() => sendPreviewEmail()}
              EndIcon={MailIcon}
              className="shrink-0">
              {t("environments.surveys.summary.send_preview")}
            </Button>
          </>
        )}
        <Button
          title="view embed code for email"
          aria-label="view embed code for email"
          onClick={() => {
            setShowEmbed(!showEmbed);
          }}
          EndIcon={Code2Icon}
          className="shrink-0">
          {showEmbed
            ? t("environments.surveys.summary.hide_embed_code")
            : t("environments.surveys.summary.view_embed_code")}
        </Button>
      </div>
      {showEmbed ? (
        <div className="prose prose-slate -mt-4 max-w-full">
          <CodeBlock
            customCodeClass="text-sm h-48 overflow-y-scroll"
            language="html"
            showCopyToClipboard={false}>
            {emailHtml}
          </CodeBlock>
        </div>
      ) : (
        <div className="mb-12 grow overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-6 flex gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500"></div>
            <div className="h-3 w-3 rounded-full bg-amber-500"></div>
            <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
          </div>
          <div>
            <div className="mb-2 border-b border-slate-200 pb-2 text-sm">To : {email || "user@mail.com"}</div>
            <div className="border-b border-slate-200 pb-2 text-sm">
              Subject : Formbricks Email Survey Preview
            </div>
            <div className="p-4">
              {emailHtml ? (
                <div dangerouslySetInnerHTML={{ __html: emailHtmlPreview }}></div>
              ) : (
                <LoadingSpinner />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
