"use client";

import {
  getIfResponseWithSurveyIdAndEmailExistAction,
  sendLinkSurveyEmailAction,
} from "@/app/s/[surveyId]/actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MailIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Toaster, toast } from "react-hot-toast";
import { z } from "zod";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { replaceHeadlineRecall } from "@formbricks/lib/utils/recall";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TProductStyling } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/Button";
import { FormControl, FormError, FormField, FormItem } from "@formbricks/ui/Form";
import { Input } from "@formbricks/ui/Input";
import { StackedCardsContainer } from "@formbricks/ui/StackedCardsContainer";

interface VerifyEmailProps {
  survey: TSurvey;
  isErrorComponent?: boolean;
  singleUseId?: string;
  languageCode: string;
  styling: TProductStyling;
  attributeClasses: TAttributeClass[];
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
  attributeClasses,
}: VerifyEmailProps) => {
  const form = useForm<TVerifyEmailInput>({
    defaultValues: {
      email: "",
    },
    resolver: zodResolver(ZVerifyEmailInput),
  });
  survey = useMemo(() => {
    return replaceHeadlineRecall(survey, "default", attributeClasses);
  }, [survey, attributeClasses]);

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
          message: "We already received a response for this email address.",
        });
        return;
      }
    }
    const data = {
      surveyId: survey.id,
      email: email as string,
      surveyName: survey.name,
      suId: singleUseId ?? "",
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
        <p className="mt-8 text-4xl font-bold">This looks fishy.</p>
        <p className="mt-4 cursor-pointer text-sm text-slate-400" onClick={handleGoBackClick}>
          Please try again with the original link
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
                <p className="mt-8 text-2xl font-bold lg:text-4xl">Verify your email to respond</p>
                <p className="mt-4 text-sm text-slate-500 lg:text-base">
                  To respond to this survey, please enter your email address below:
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
                              Verify
                            </Button>
                          </div>
                          {error?.message && <FormError className="mt-2">{error.message}</FormError>}
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <p className="mt-6 cursor-pointer text-xs text-slate-400" onClick={handlePreviewClick}>
                  Just curious? <span className="underline">Preview survey questions.</span>
                </p>
              </div>
            )}
          </form>
        </FormProvider>
        {!emailSent && showPreviewQuestions && (
          <div>
            <p className="text-4xl font-bold">Question Preview</p>
            <div className="mt-4 flex w-full flex-col justify-center rounded-lg border border-slate-200 bg-slate-50 bg-opacity-20 p-8 text-slate-700">
              {survey.questions.map((question, index) => (
                <p
                  key={index}
                  className="my-1">{`${index + 1}. ${getLocalizedValue(question.headline, languageCode)}`}</p>
              ))}
            </div>
            <p className="mt-6 cursor-pointer text-xs text-slate-400" onClick={handlePreviewClick}>
              Want to respond? <span className="underline">Verify email.</span>
            </p>
          </div>
        )}
        {emailSent && (
          <div>
            <h1 className="mt-8 text-2xl font-bold lg:text-4xl">Survey sent to {form.getValues().email}</h1>
            <p className="mt-4 text-center text-sm text-slate-500 lg:text-base">
              Please also check your spam folder if you don&apos;t see the email in your inbox.
            </p>
            <Button
              variant="secondary"
              className="mt-6"
              size="sm"
              onClick={handleGoBackClick}
              StartIcon={ArrowLeft}>
              Back
            </Button>
          </div>
        )}
      </StackedCardsContainer>
    </div>
  );
};
