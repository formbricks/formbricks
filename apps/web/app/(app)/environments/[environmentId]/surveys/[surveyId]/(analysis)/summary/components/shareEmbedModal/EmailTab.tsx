"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { OptionsSwitch } from "@/modules/ui/components/options-switch";
import { useTranslate } from "@tolgee/react";
import { CopyIcon, MailIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AuthenticationError } from "@formbricks/types/errors";
import { getEmailHtmlAction, sendEmbedSurveyPreviewEmailAction } from "../../actions";

interface EmailTabProps {
  surveyId: string;
  email: string;
}

const PreviewTab = ({
  emailHtmlPreview,
  email,
  surveyId,
}: {
  emailHtmlPreview: string;
  email: string;
  surveyId: string;
}) => {
  const { t } = useTranslate();

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
    <div className="space-y-4">
      <div className="grow overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
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
            {emailHtmlPreview ? (
              <div dangerouslySetInnerHTML={{ __html: emailHtmlPreview }}></div>
            ) : (
              <LoadingSpinner />
            )}
          </div>
        </div>
      </div>
      <Button
        variant="default"
        title="send preview email"
        aria-label="send preview email"
        onClick={() => sendPreviewEmail()}
        className="shrink-0">
        {t("environments.surveys.summary.send_preview")}
        <MailIcon />
      </Button>
    </div>
  );
};

const EmbedCodeTab = ({ emailHtml }: { emailHtml: string }) => {
  const { t } = useTranslate();

  return (
    <div className="space-y-4">
      <div className="prose prose-slate -mt-4 max-w-full">
        <CodeBlock
          customCodeClass="text-sm h-48 overflow-y-scroll"
          language="html"
          showCopyToClipboard={false}>
          {emailHtml}
        </CodeBlock>
      </div>
      <Button
        variant="default"
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
    </div>
  );
};

export const EmailTab = ({ surveyId, email }: EmailTabProps) => {
  const [emailHtmlPreview, setEmailHtmlPreview] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState("preview");
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

  return (
    <div className="flex max-h-full flex-col gap-4">
      <OptionsSwitch
        options={[
          { value: "preview", label: t("environments.surveys.summary.preview") },
          { value: "embed", label: t("environments.surveys.summary.embed_code") },
        ]}
        currentOption={selectedTab}
        handleOptionChange={(value) => setSelectedTab(value)}
      />

      {selectedTab === "preview" ? (
        <PreviewTab emailHtmlPreview={emailHtmlPreview} email={email} surveyId={surveyId} />
      ) : (
        <EmbedCodeTab emailHtml={emailHtml} />
      )}
    </div>
  );
};
