"use client";

import { TabContainer } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/tab-container";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { TabBar } from "@/modules/ui/components/tab-bar";
import { useTranslate } from "@tolgee/react";
import { Code2Icon, CopyIcon, EyeIcon, SendIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AuthenticationError } from "@formbricks/types/errors";
import { getEmailHtmlAction, sendEmbedSurveyPreviewEmailAction } from "../../actions";

interface EmailTabProps {
  surveyId: string;
  email: string;
}

export const EmailTab = ({ surveyId, email }: EmailTabProps) => {
  const [activeTab, setActiveTab] = useState("preview");
  const [emailHtmlPreview, setEmailHtmlPreview] = useState<string>("");
  const { t } = useTranslate();
  const emailHtml = useMemo(() => {
    if (!emailHtmlPreview) return "";
    return emailHtmlPreview
      .replaceAll("?preview=true&amp;", "?")
      .replaceAll("?preview=true&;", "?")
      .replaceAll("?preview=true", "");
  }, [emailHtmlPreview]);

  const tabs = [
    {
      id: "preview",
      label: t("environments.surveys.share.send_email.email_preview_tab"),
      icon: <EyeIcon className="h-4 w-4" />,
    },
    {
      id: "embed",
      label: t("environments.surveys.share.send_email.embed_code_tab"),
      icon: <Code2Icon className="h-4 w-4" />,
    },
  ];

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
        toast.success(t("environments.surveys.share.send_email.email_sent"));
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

  const renderTabContent = () => {
    if (activeTab === "preview") {
      return (
        <div className="space-y-4 pb-4">
          <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-6 flex gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500"></div>
              <div className="h-3 w-3 rounded-full bg-amber-500"></div>
              <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
            </div>
            <div>
              <div className="mb-2 border-b border-slate-200 pb-2 text-sm">
                {t("environments.surveys.share.send_email.email_to_label")} : {email || "user@mail.com"}
              </div>
              <div className="border-b border-slate-200 pb-2 text-sm">
                {t("environments.surveys.share.send_email.email_subject_label")} :{" "}
                {t("environments.surveys.share.send_email.formbricks_email_survey_preview")}
              </div>
              <div className="p-2">
                {emailHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: emailHtmlPreview }}></div>
                ) : (
                  <LoadingSpinner />
                )}
              </div>
            </div>
          </div>
          <Button
            title={t("environments.surveys.share.send_email.send_preview_email")}
            aria-label={t("environments.surveys.share.send_email.send_preview_email")}
            onClick={() => sendPreviewEmail()}
            className="shrink-0">
            {t("environments.surveys.share.send_email.send_preview")}
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
            title={t("environments.surveys.share.send_email.copy_embed_code")}
            aria-label={t("environments.surveys.share.send_email.copy_embed_code")}
            onClick={() => {
              toast.success(t("environments.surveys.share.send_email.embed_code_copied_to_clipboard"));
              navigator.clipboard.writeText(emailHtml);
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
    <TabContainer
      title={t("environments.surveys.share.send_email.title")}
      description={t("environments.surveys.share.send_email.description")}>
      <div className="flex h-full w-full flex-col space-y-4">
        <TabBar
          tabs={tabs}
          activeId={activeTab}
          setActiveId={setActiveTab}
          tabStyle="button"
          className="border border-slate-200 bg-white"
        />

        <div className="flex-1">{renderTabContent()}</div>
      </div>
    </TabContainer>
  );
};
