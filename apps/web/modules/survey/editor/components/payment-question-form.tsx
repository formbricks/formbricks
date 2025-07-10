"use client";

import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { OptionsSwitch } from "@/modules/ui/components/options-switch";
import { Switch } from "@/modules/ui/components/switch";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useTranslate } from "@tolgee/react";
import { type JSX, useState } from "react";
import { TSurvey, TSurveyPaymentQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface PaymentQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyPaymentQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyPaymentQuestion>) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
}

export const PaymentQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  locale,
}: PaymentQuestionFormProps): JSX.Element => {
  const { t } = useTranslate();
  const [parent] = useAutoAnimate();

  const paymentTypeOptions = [
    { value: "one-time", label: t("environments.surveys.edit.one_time_payment") },
    { value: "subscription", label: t("environments.surveys.edit.subscription_payment") },
  ];

  const currencyOptions = [
    { value: "USD", label: "USD ($)" },
    { value: "EUR", label: "EUR (€)" },
    { value: "GBP", label: "GBP (£)" },
    { value: "CAD", label: "CAD ($)" },
    { value: "AUD", label: "AUD ($)" },
    { value: "JPY", label: "JPY (¥)" },
  ];

  const intervalOptions = [
    { value: "day", label: t("common.day") },
    { value: "week", label: t("common.week") },
    { value: "month", label: t("common.month") },
    { value: "year", label: t("common.year") },
  ];

  return (
    <form ref={parent}>
      <QuestionFormInput
        id="headline"
        value={question.headline}
        label={t("environments.surveys.edit.question") + "*"}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
      />

      <div className="mt-3">
        <QuestionFormInput
          id="subheader"
          value={question.subheader}
          label={t("common.description")}
          localSurvey={localSurvey}
          questionIdx={questionIdx}
          isInvalid={isInvalid}
          updateQuestion={updateQuestion}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
          locale={locale}
        />
      </div>

      <div className="mt-3">
        <Label htmlFor="paymentType">{t("environments.surveys.edit.payment_type")}</Label>
        <div className="mt-2">
          <OptionsSwitch
            options={paymentTypeOptions}
            currentOption={question.paymentType}
            handleOptionChange={(value) => updateQuestion(questionIdx, { paymentType: value as "one-time" | "subscription" })}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="amount">{t("environments.surveys.edit.amount")} *</Label>
          <div className="mt-2">
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={question.amount}
              placeholder="10.00"
              onChange={(e) => updateQuestion(questionIdx, { amount: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="currency">{t("environments.surveys.edit.currency")} *</Label>
          <div className="mt-2">
            <select
              id="currency"
              name="currency"
              value={question.currency}
              onChange={(e) => updateQuestion(questionIdx, { currency: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand focus:ring-brand sm:text-sm">
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {question.paymentType === "subscription" && (
        <div className="mt-3">
          <Label htmlFor="subscriptionInterval">{t("environments.surveys.edit.subscription_interval")}</Label>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Input
                id="intervalCount"
                name="intervalCount"
                type="number"
                min="1"
                value={question.subscriptionData?.intervalCount || 1}
                placeholder="1"
                onChange={(e) => 
                  updateQuestion(questionIdx, { 
                    subscriptionData: {
                      ...question.subscriptionData,
                      intervalCount: parseInt(e.target.value) || 1,
                      interval: question.subscriptionData?.interval || "month",
                    }
                  })
                }
              />
            </div>
            <div>
              <select
                id="interval"
                name="interval"
                value={question.subscriptionData?.interval || "month"}
                onChange={(e) => 
                  updateQuestion(questionIdx, { 
                    subscriptionData: {
                      ...question.subscriptionData,
                      interval: e.target.value as "day" | "week" | "month" | "year",
                      intervalCount: question.subscriptionData?.intervalCount || 1,
                    }
                  })
                }
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand focus:ring-brand sm:text-sm">
                {intervalOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {question.paymentType === "subscription" && (
        <div className="mt-3">
          <Label htmlFor="trialPeriod">{t("environments.surveys.edit.trial_period_days")}</Label>
          <div className="mt-2">
            <Input
              id="trialPeriod"
              name="trialPeriod"
              type="number"
              min="0"
              value={question.subscriptionData?.trialPeriodDays || ""}
              placeholder="7"
              onChange={(e) => 
                updateQuestion(questionIdx, { 
                  subscriptionData: {
                    ...question.subscriptionData,
                    trialPeriodDays: parseInt(e.target.value) || undefined,
                    interval: question.subscriptionData?.interval || "month",
                    intervalCount: question.subscriptionData?.intervalCount || 1,
                  }
                })
              }
            />
          </div>
        </div>
      )}

      <div className="mt-3 space-y-3">
        <div className="flex items-center space-x-2">
          <Switch
            id="collectBillingAddress"
            checked={question.collectBillingAddress}
            onCheckedChange={(checked) => updateQuestion(questionIdx, { collectBillingAddress: checked })}
          />
          <Label htmlFor="collectBillingAddress">{t("environments.surveys.edit.collect_billing_address")}</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="collectShippingAddress"
            checked={question.collectShippingAddress}
            onCheckedChange={(checked) => updateQuestion(questionIdx, { collectShippingAddress: checked })}
          />
          <Label htmlFor="collectShippingAddress">{t("environments.surveys.edit.collect_shipping_address")}</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="allowPromotionCodes"
            checked={question.allowPromotionCodes}
            onCheckedChange={(checked) => updateQuestion(questionIdx, { allowPromotionCodes: checked })}
          />
          <Label htmlFor="allowPromotionCodes">{t("environments.surveys.edit.allow_promotion_codes")}</Label>
        </div>
      </div>

      <div className="mt-2 flex justify-between gap-8">
        <div className="flex w-full space-x-2">
          {questionIdx !== 0 && (
            <QuestionFormInput
              id="backButtonLabel"
              value={question.backButtonLabel}
              label={t("environments.surveys.edit.back_button_label")}
              localSurvey={localSurvey}
              questionIdx={questionIdx}
              maxLength={48}
              placeholder={"Back"}
              isInvalid={isInvalid}
              updateQuestion={updateQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              locale={locale}
            />
          )}
          <QuestionFormInput
            id="buttonLabel"
            value={question.buttonLabel}
            label={t("environments.surveys.edit.payment_button_label")}
            localSurvey={localSurvey}
            questionIdx={questionIdx}
            maxLength={48}
            placeholder={question.paymentType === "subscription" ? "Subscribe" : "Pay Now"}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            locale={locale}
          />
        </div>
      </div>
    </form>
  );
};