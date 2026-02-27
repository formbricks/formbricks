"use client";

import { CheckCircle2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";

const FORMBRICKS_HOST = "https://app.formbricks.com";
const SURVEY_ID = "cr9r4b2r73x6hlmn5aa2ha44";
const ENVIRONMENT_ID = "cmk41i8bi92bdad01svi74dec";

interface WorkflowsPageProps {
  userEmail: string;
  organizationName: string;
  billingPlan: string;
}

type Step = "prompt" | "followup" | "thankyou";

export const WorkflowsPage = ({ userEmail, organizationName, billingPlan }: WorkflowsPageProps) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("prompt");
  const [promptValue, setPromptValue] = useState("");
  const [detailsValue, setDetailsValue] = useState("");
  const [responseId, setResponseId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGenerateWorkflow = async () => {
    if (promptValue.trim().length < 100 || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`${FORMBRICKS_HOST}/api/v2/client/${ENVIRONMENT_ID}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyId: SURVEY_ID,
          finished: false,
          data: {
            workflow: promptValue.trim(),
            useremail: userEmail,
            orgname: organizationName,
            billingplan: billingPlan,
          },
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setResponseId(json.data?.id ?? null);
      }

      setStep("followup");
    } catch {
      setStep("followup");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (responseId) {
      try {
        await fetch(`${FORMBRICKS_HOST}/api/v1/client/${ENVIRONMENT_ID}/responses/${responseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            finished: true,
            data: {
              details: detailsValue.trim(),
            },
          }),
        });
      } catch {
        // silently fail
      }
    }

    setIsSubmitting(false);
    setStep("thankyou");
  };

  const handleSkipFeedback = async () => {
    if (!responseId) {
      setStep("thankyou");
      return;
    }

    try {
      await fetch(`${FORMBRICKS_HOST}/api/v1/client/${ENVIRONMENT_ID}/responses/${responseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finished: true,
          data: {},
        }),
      });
    } catch {
      // silently fail
    }

    setStep("thankyou");
  };

  if (step === "prompt") {
    return (
      <div className="flex h-full flex-col items-center px-4 pt-[15vh]">
        <div className="w-full max-w-2xl space-y-8">
          <div className="space-y-3 text-center">
            <div className="from-brand-light to-brand-dark mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-md">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-800">{t("workflows.heading")}</h1>
            <p className="text-lg text-slate-500">{t("workflows.subheading")}</p>
          </div>

          <div className="relative">
            <textarea
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={t("workflows.placeholder")}
              rows={5}
              className="focus:border-brand-dark focus:ring-brand-light/20 w-full resize-none rounded-xl border border-slate-200 bg-white px-5 py-4 text-base text-slate-800 shadow-sm transition-all placeholder:text-slate-400 focus:outline-none focus:ring-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleGenerateWorkflow();
                }
              }}
            />
            <div className="mt-3 flex items-center justify-between">
              <span
                className={`text-xs ${promptValue.trim().length >= 100 ? "text-slate-400" : "text-slate-400"}`}>
                {promptValue.trim().length} / 100
              </span>
              <Button
                onClick={handleGenerateWorkflow}
                disabled={promptValue.trim().length < 100 || isSubmitting}
                loading={isSubmitting}
                size="lg">
                <Sparkles className="h-4 w-4" />
                {t("workflows.generate_button")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "followup") {
    return (
      <div className="flex h-full flex-col items-center px-4 pt-[15vh]">
        <div className="w-full max-w-2xl space-y-8">
          <div className="space-y-3 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
              <Sparkles className="text-brand-dark h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">
              {t("workflows.coming_soon_title")}
            </h1>
            <p className="mx-auto max-w-md text-base text-slate-500">
              {t("workflows.coming_soon_description")}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="text-md mb-2 block font-medium text-slate-700">
              {t("workflows.follow_up_label")}
            </label>
            <textarea
              value={detailsValue}
              onChange={(e) => setDetailsValue(e.target.value)}
              placeholder={t("workflows.follow_up_placeholder")}
              rows={4}
              className="focus:border-brand-dark focus:ring-brand-light/20 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2"
            />
            <div className="mt-4 flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={handleSkipFeedback} className="text-slate-500">
                Skip
              </Button>
              <Button
                onClick={handleSubmitFeedback}
                disabled={!detailsValue.trim() || isSubmitting}
                loading={isSubmitting}>
                {t("workflows.submit_button")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center px-4 pt-[15vh]">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">{t("workflows.thank_you_title")}</h1>
        <p className="text-base text-slate-500">{t("workflows.thank_you_description")}</p>
      </div>
    </div>
  );
};
