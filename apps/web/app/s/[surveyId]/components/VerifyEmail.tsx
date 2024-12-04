"use client";

import {
  getIfResponseWithSurveyIdAndEmailExistAction,
  sendLinkSurveyEmailAction,
} from "@/app/s/[surveyId]/actions";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormError, FormField, FormItem } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { StackedCardsContainer } from "@/modules/ui/components/stacked-cards-container";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Toaster, toast } from "react-hot-toast";
import { z } from "zod";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { replaceHeadlineRecall } from "@formbricks/lib/utils/recall";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TProjectStyling } from "@formbricks/types/project";
import { TSurvey } from "@formbricks/types/surveys/types";

interface VerifyEmailProps {
  survey: TSurvey;
  isErrorComponent?: boolean;
  singleUseId?: string;
  languageCode: string;
  contactAttributeKeys: TContactAttributeKey[];
  styling: TProjectStyling;
  locale: string;
}

const ZVerifyEmailInput = z.object({
  email: z.string().email(),
});
type TVerifyEmailInput = z.infer<typeof ZVerifyEmailInput>;

export const VerifyEmail = ({
  survey,
  isErrorComponent,
  singleUseId,
  languageCode,
  styling,
  contactAttributeKeys,
  locale,
}: VerifyEmailProps) => {
  const t = useTranslations();
  const form = useForm<TVerifyEmailInput>({
    defaultValues: {
      email: "",
    },
    resolver: zodResolver(ZVerifyEmailInput),
  });
  survey = useMemo(() => {
    return replaceHeadlineRecall(survey, "default", contactAttributeKeys);
  }, [survey, contactAttributeKeys]);

  const { isSubmitting } = form.formState;
  const [showPreviewQuestions, setShowPreviewQuestions] = useState(false);
  const [emailSent, setEmailSent] = useState<boolean>(false);

  const submitEmail = async (emailInput: TVerifyEmailInput) => {
    const email = emailInput.email.toLowerCase();
    if (survey.isSingleResponsePerEmailEnabled) {
      const actionResult = await getIfResponseWithSurveyIdAndEmailExistAction({
        surveyId: survey.id,
        email,
      });
      if (actionResult?.data) {
        form.setError("email", {
          type: "custom",
          message: t("s.response_already_received"),
        });
        return;
      }
    }
    const data = {
      surveyId: survey.id,
      email: email as string,
      surveyName: survey.name,
      suId: singleUseId ?? "",
      locale,
    };
    try {
      await sendLinkSurveyEmailAction(data);
      setEmailSent(true);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handlePreviewClick = () => {
    setShowPreviewQuestions(!showPreviewQuestions);
  };

  const handleGoBackClick = () => {
    setShowPreviewQuestions(false);
    setEmailSent(false);
  };

  if (isErrorComponent) {
    return (
      <div className="flex h-[100vh] w-[100vw] flex-col items-center justify-center bg-slate-50">
        <span className="h-24 w-24 rounded-full bg-slate-300 p-6 text-5xl">🤔</span>
        <p className="mt-8 text-4xl font-bold">{t("s.this_looks_fishy")}</p>
        <p className="mt-4 cursor-pointer text-sm text-slate-400" onClick={handleGoBackClick}>
          {t("s.please_try_again_with_the_original_link")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center">
      <Toaster />
      <StackedCardsContainer
        cardArrangement={
          survey.styling?.cardArrangement?.linkSurveys ?? styling.cardArrangement?.linkSurveys ?? "straight"
        }>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(submitEmail)}>
            {!emailSent && !showPreviewQuestions && (
              <div className="flex flex-col">
                <div className="mx-auto rounded-full border bg-slate-200 p-6">
                  <MailIcon strokeWidth={1.5} className="mx-auto h-12 w-12 text-white" />
                </div>
                <p className="mt-8 text-2xl font-bold lg:text-4xl">{t("s.verify_email_before_submission")}</p>
                <p className="mt-4 text-sm text-slate-500 lg:text-base">
                  {t("s.verify_email_before_submission_description")}
                </p>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field, fieldState: { error } }) => (
                    <FormItem className="my-4 w-full space-y-4">
                      <FormControl>
                        <div>
                          <div className="flex space-x-2">
                            <Input
                              value={field.value}
                              onChange={(email) => field.onChange(email)}
                              type="email"
                              placeholder="engineering@acme.com"
                              className="h-10 bg-white"
                            />
                            <Button type="submit" size="sm" loading={isSubmitting}>
                              {t("s.verify_email_before_submission_button")}
                            </Button>
                          </div>
                          {error?.message && <FormError className="mt-2">{error.message}</FormError>}
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <p className="mt-6 cursor-pointer text-xs text-slate-400" onClick={handlePreviewClick}>
                  {t("s.just_curious")} <span className="underline">{t("s.preview_survey_questions")}</span>
                </p>
              </div>
            )}
          </form>
        </FormProvider>
        {!emailSent && showPreviewQuestions && (
          <div>
            <p className="text-4xl font-bold">{t("s.question_preview")}</p>
            <div className="mt-4 flex w-full flex-col justify-center rounded-lg border border-slate-200 bg-slate-50 bg-opacity-20 p-8 text-slate-700">
              {survey.questions.map((question, index) => (
                <p
                  key={index}
                  className="my-1">{`${index + 1}. ${getLocalizedValue(question.headline, languageCode)}`}</p>
              ))}
            </div>
            <p className="mt-6 cursor-pointer text-xs text-slate-400" onClick={handlePreviewClick}>
              {t("s.want_to_respond")} <span className="underline">{t("s.verify_email")}</span>
            </p>
          </div>
        )}
        {emailSent && (
          <div>
            <h1 className="mt-8 text-2xl font-bold lg:text-4xl">
              {t("s.survey_sent_to", { email: form.getValues().email })}
            </h1>
            <p className="mt-4 text-center text-sm text-slate-500 lg:text-base">
              {t("s.check_inbox_or_spam")}
            </p>
            <Button variant="secondary" className="mt-6" size="sm" onClick={handleGoBackClick}>
              <ArrowLeft />
              {t("common.back")}
            </Button>
          </div>
        )}
      </StackedCardsContainer>
    </div>
  );
};
