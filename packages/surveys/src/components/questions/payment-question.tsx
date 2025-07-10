import { BackButton } from "@/components/buttons/back-button";
import { SubmitButton } from "@/components/buttons/submit-button";
import { Headline } from "@/components/general/headline";
import { QuestionMedia } from "@/components/general/question-media";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { useEffect, useState } from "react";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyPaymentQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface PaymentQuestionProps {
  question: TSurveyPaymentQuestion;
  value: string;
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentQuestionId: TSurveyQuestionId;
  isBackButtonHidden: boolean;
  environmentId: string;
  surveyId: string;
  stripePublishableKey?: string;
}

export function PaymentQuestion({
  question,
  onSubmit,
  onChange,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  autoFocusEnabled,
  currentQuestionId,
  isBackButtonHidden,
  environmentId,
  surveyId,
  stripePublishableKey,
}: Readonly<PaymentQuestionProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const isCurrent = question.id === currentQuestionId;

  useTtc(question.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  const handlePayment = async () => {
    if (!stripePublishableKey) {
      setError("Stripe is not configured. Please contact the administrator.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create a Stripe Checkout session through your API
      const response = await fetch(`/api/stripe/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(question.amount * 100), // Convert to cents
          currency: question.currency,
          paymentType: question.paymentType,
          environmentId,
          surveyId,
          questionId: question.id,
          collectBillingAddress: question.collectBillingAddress,
          collectShippingAddress: question.collectShippingAddress,
          allowPromotionCodes: question.allowPromotionCodes,
          subscriptionData: question.subscriptionData,
          successUrl: `${window.location.origin}/payment-success?surveyId=${surveyId}&questionId=${question.id}`,
          cancelUrl: window.location.href,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { url, sessionId } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const getPaymentButtonText = () => {
    if (question.paymentType === "subscription") {
      const interval = question.subscriptionData?.interval || "month";
      const intervalCount = question.subscriptionData?.intervalCount || 1;
      const intervalText = intervalCount === 1 ? interval : `${intervalCount} ${interval}s`;
      return `Subscribe ${formatAmount(question.amount, question.currency)}/${intervalText}`;
    }
    return `Pay ${formatAmount(question.amount, question.currency)}`;
  };

  return (
    <div key={question.id}>
      <ScrollableContainer>
        <div>
          {isMediaAvailable ? (
            <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />
          ) : null}
          <Headline
            headline={getLocalizedValue(question.headline, languageCode)}
            questionId={question.id}
            required={question.required}
          />
          {question.subheader && (
            <p className="fb-text-subheading fb-mb-4 fb-mt-2 fb-text-sm">
              {getLocalizedValue(question.subheader, languageCode)}
            </p>
          )}
          
          <div className="fb-bg-brand-light fb-rounded-lg fb-border fb-p-4 fb-mb-4">
            <div className="fb-flex fb-items-center fb-justify-between fb-mb-2">
              <span className="fb-text-lg fb-font-medium">
                {question.paymentType === "subscription" ? "Subscription" : "Payment"}
              </span>
              <span className="fb-text-2xl fb-font-bold fb-text-brand">
                {formatAmount(question.amount, question.currency)}
                {question.paymentType === "subscription" && 
                  `/${question.subscriptionData?.intervalCount === 1 ? '' : question.subscriptionData?.intervalCount}${question.subscriptionData?.interval || 'month'}`
                }
              </span>
            </div>
            {question.paymentType === "subscription" && question.subscriptionData?.trialPeriodDays && (
              <p className="fb-text-sm fb-text-slate-600">
                {question.subscriptionData.trialPeriodDays} day free trial
              </p>
            )}
          </div>

          {error && (
            <div className="fb-bg-red-50 fb-border fb-border-red-200 fb-rounded-lg fb-p-3 fb-mb-4">
              <p className="fb-text-red-700 fb-text-sm">{error}</p>
            </div>
          )}

          {!stripePublishableKey && (
            <div className="fb-bg-yellow-50 fb-border fb-border-yellow-200 fb-rounded-lg fb-p-3 fb-mb-4">
              <p className="fb-text-yellow-700 fb-text-sm">
                Stripe is not configured. Please contact the administrator.
              </p>
            </div>
          )}
        </div>
      </ScrollableContainer>

      <div className="fb-flex fb-flex-row-reverse fb-w-full fb-justify-between fb-px-6 fb-py-4">
        <div className="fb-flex fb-flex-row-reverse fb-w-full fb-justify-start">
          <SubmitButton
            buttonLabel={getPaymentButtonText()}
            isLastQuestion={isLastQuestion}
            focus={isCurrent ? autoFocusEnabled : false}
            tabIndex={isCurrent ? 0 : -1}
            onClick={() => {
              handlePayment();
            }}
            type="button"
          />
          {!question.required && (
            <button
              dir="auto"
              type="button"
              tabIndex={isCurrent ? 0 : -1}
              onClick={() => {
                const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
                setTtc(updatedTtcObj);
                onSubmit({ [question.id]: "skipped" }, updatedTtcObj);
                onChange({ [question.id]: "skipped" });
              }}
              className="fb-text-heading focus:fb-ring-focus fb-mr-4 fb-flex fb-items-center fb-rounded-md fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2"
              disabled={isLoading}>
              Skip
            </button>
          )}
        </div>
        {!isFirstQuestion && !isBackButtonHidden && (
          <BackButton
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedTtcObj);
              onBack();
            }}
          />
        )}
      </div>
    </div>
  );
}