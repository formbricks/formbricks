"use client";

import DOMPurify from "dompurify";
import { CopyIcon, SendIcon } from "lucide-react";
import { type SyntheticEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { V3ApiError, getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { TabBar } from "@/modules/ui/components/tab-bar";
import { useSurveyEmailEmbed } from "../../hooks/use-survey-email-embed";
import { sendSurveyPreviewEmail } from "../../lib/api-client";

interface EmailTabProps {
  readonly surveyId: string;
  readonly email: string;
}

export const EmailTab = ({ surveyId, email }: EmailTabProps) => {
  const [activeTab, setActiveTab] = useState("preview");
  // Empty until the survey is rendered, which shows the spinner; a failed render shows an error to retry.
  const emailEmbed = useSurveyEmailEmbed(surveyId);
  const emailHtmlPreview = emailEmbed.data?.html ?? "";
  const isEmailEmbedFailed = emailEmbed.isError && !emailEmbed.isFetching;
  const [previewFrameHeight, setPreviewFrameHeight] = useState(560);
  const { t } = useTranslation();

  const emailHtml = useMemo(() => {
    if (!emailHtmlPreview) return "";
    return emailHtmlPreview
      .replaceAll("?preview=true&amp;", "?")
      .replaceAll("?preview=true&;", "?")
      .replaceAll("?preview=true", "");
  }, [emailHtmlPreview]);

  const sanitizedEmailHtml = useMemo(() => {
    if (!emailHtmlPreview) return "";
    return DOMPurify.sanitize(emailHtmlPreview, { ADD_ATTR: ["bgcolor", "target"] });
  }, [emailHtmlPreview]);

  const emailPreviewDocument = useMemo(() => {
    if (!sanitizedEmailHtml) return "";

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="only light" />
    <meta name="supported-color-schemes" content="light" />
    <base target="_blank" />
    <style>
      :root {
        color-scheme: only light;
        supported-color-schemes: light;
      }

      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color-scheme: only light;
      }
    </style>
  </head>
  <body>${sanitizedEmailHtml}</body>
</html>`;
  }, [sanitizedEmailHtml]);

  const tabs = [
    {
      id: "preview",
      label: t("workspace.surveys.share.send_email.email_preview_tab"),
    },
    {
      id: "embed",
      label: t("workspace.surveys.share.send_email.embed_code_tab"),
    },
  ];

  useEffect(() => {
    setPreviewFrameHeight(560);
  }, [emailPreviewDocument]);

  const handlePreviewFrameLoad = (event: SyntheticEvent<HTMLIFrameElement>) => {
    const { contentDocument } = event.currentTarget;
    if (!contentDocument) {
      return;
    }

    const nextHeight = Math.max(
      contentDocument.body.scrollHeight,
      contentDocument.documentElement.scrollHeight,
      560
    );

    setPreviewFrameHeight(nextHeight);
  };

  const sendPreviewEmail = async () => {
    try {
      const { emailSent } = await sendSurveyPreviewEmail(surveyId);
      if (emailSent) {
        toast.success(t("workspace.surveys.share.send_email.email_sent"));
      } else {
        toast.error(t("common.something_went_wrong_please_try_again"));
      }
    } catch (error) {
      if (error instanceof V3ApiError && error.status === 401) {
        toast.error(t("common.not_authenticated"));
        return;
      }
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    }
  };

  const renderPreview = () => {
    if (isEmailEmbedFailed) {
      return (
        <Alert variant="error" size="small" className="mt-2">
          <AlertTitle>
            {getV3ApiErrorMessage(emailEmbed.error, t("common.something_went_wrong_please_try_again"))}
          </AlertTitle>
          <AlertButton onClick={() => void emailEmbed.refetch()}>{t("common.retry")}</AlertButton>
        </Alert>
      );
    }
    if (!emailPreviewDocument) return <LoadingSpinner />;
    return (
      <iframe
        className="mt-2 w-full rounded-md border-0 bg-white"
        data-testid="survey-email-preview-frame"
        onLoad={handlePreviewFrameLoad}
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        srcDoc={emailPreviewDocument}
        style={{ height: `${previewFrameHeight}px` }}
        title={t("workspace.surveys.share.send_email.email_preview_tab")}
      />
    );
  };

  const renderTabContent = () => {
    if (activeTab === "preview") {
      return (
        <div className="space-y-4 pb-4">
          <div
            className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4"
            data-testid="survey-email-preview-shell">
            <div className="mb-6 flex gap-2">
              <div className="size-3 rounded-full bg-red-500" />
              <div className="size-3 rounded-full bg-amber-500" />
              <div className="size-3 rounded-full bg-emerald-500" />
            </div>
            <div>
              <div className="mb-2 border-b border-slate-200 pb-2 text-sm">
                {t("workspace.surveys.share.send_email.email_to_label")} : {email || "user@mail.com"}
              </div>
              <div className="border-b border-slate-200 pb-2 text-sm">
                {t("workspace.surveys.share.send_email.email_subject_label")} :{" "}
                {t("workspace.surveys.share.send_email.formbricks_email_survey_preview")}
              </div>
              <div data-testid="survey-email-preview-content">{renderPreview()}</div>
            </div>
          </div>
          <Button
            title={t("workspace.surveys.share.send_email.send_preview_email")}
            aria-label={t("workspace.surveys.share.send_email.send_preview_email")}
            onClick={() => sendPreviewEmail()}
            className="shrink-0">
            {t("workspace.surveys.share.send_email.send_preview")}
            <SendIcon />
          </Button>
        </div>
      );
    }

    if (activeTab === "embed") {
      return (
        <div className="space-y-4 pb-4">
          <CodeBlock
            customCodeClass="text-sm h-96 overflow-y-scroll"
            language="html"
            showCopyToClipboard
            noMargin>
            {emailHtml}
          </CodeBlock>
          <Button
            title={t("workspace.surveys.share.send_email.copy_embed_code")}
            aria-label={t("workspace.surveys.share.send_email.copy_embed_code")}
            onClick={async () => {
              if (await copyToClipboard(emailHtml)) {
                toast.success(t("workspace.surveys.share.send_email.embed_code_copied_to_clipboard"));
              } else {
                toast.error(t("workspace.surveys.share.send_email.embed_code_copied_to_clipboard_failed"));
              }
            }}
            className="shrink-0">
            {t("common.copy_code")}
            <CopyIcon />
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex h-full w-full flex-col gap-y-4">
      <TabBar
        tabs={tabs}
        activeId={activeTab}
        setActiveId={setActiveTab}
        tabStyle="button"
        className="h-10 min-h-10 rounded-md border border-slate-200 bg-slate-100"
      />
      <div className="flex-1">{renderTabContent()}</div>
    </div>
  );
};
