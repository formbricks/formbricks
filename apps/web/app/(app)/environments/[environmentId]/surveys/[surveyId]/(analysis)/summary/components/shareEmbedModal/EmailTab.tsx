"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { useTranslate } from "@tolgee/react";
import { Code2Icon, CopyIcon, MailIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AuthenticationError } from "@formbricks/types/errors";
import { getEmailHtmlAction, sendEmbedSurveyPreviewEmailAction } from "../../actions";

interface EmailTabProps {
  surveyId: string;
  email: string;
}

export const EmailTab = ({ surveyId, email }: EmailTabProps) => {
  const [showEmbed, setShowEmbed] = useState(false);
  const [emailHtmlPreview, setEmailHtmlPreview] = useState<string>("");
  const { t } = useTranslate();
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
      const val = await sendEmbedSurveyPreviewEmailAction({ surveyId });
      if (val?.data) {
        toast.success(t("environments.surveys.summary.email_sent"));
      } else {
        const errorMessage = getFormattedErrorMessage(val);
        toast.error(errorMessage);
      }
    } catch (err) {
      if (err instanceof AuthenticationError) {
        toast.error(t("common.not_authenticated"));
        return;
      }
      toast.error(t("common.something_went_wrong_please_try_again"));
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
              toast.success(t("environments.surveys.summary.embed_code_copied_to_clipboard"));
              navigator.clipboard.writeText(emailHtml);
            }}
            className="shrink-0">
            {t("common.copy_code")}
            <CopyIcon />
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              title="send preview email"
              aria-label="send preview email"
              onClick={() => sendPreviewEmail()}
              className="shrink-0">
              {t("environments.surveys.summary.send_preview")}
              <MailIcon />
            </Button>
          </>
        )}
        <Button
          title={t("environments.surveys.summary.view_embed_code_for_email")}
          aria-label={t("environments.surveys.summary.view_embed_code_for_email")}
          onClick={() => {
            setShowEmbed(!showEmbed);
          }}
          className="shrink-0">
          {showEmbed
            ? t("environments.surveys.summary.hide_embed_code")
            : t("environments.surveys.summary.view_embed_code")}
          <Code2Icon />
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
              Subject : {t("environments.surveys.summary.formbricks_email_survey_preview")}
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
