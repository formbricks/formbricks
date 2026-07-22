"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import { KeyboardEventHandler, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Trans, useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { cn } from "@/lib/cn";
import {
  type TSurveySchedulingConfig,
  getSurveySchedulingTimeLabel,
} from "@/modules/survey/scheduling/lib/config";
import {
  createSurveySchedulingDateUtils,
  toDateOnlySelection,
} from "@/modules/survey/scheduling/lib/date-utils";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Alert, AlertTitle } from "@/modules/ui/components/alert";
import { DatePicker } from "@/modules/ui/components/date-picker";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Slider } from "@/modules/ui/components/slider";

interface ResponseOptionsCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey | ((prev: TSurvey) => TSurvey)) => void;
  responseCount: number;
  isSpamProtectionAllowed: boolean;
  surveySchedulingConfig: TSurveySchedulingConfig;
  locale: TUserLocale;
}

export const ResponseOptionsCard = ({
  localSurvey,
  setLocalSurvey,
  responseCount,
  isSpamProtectionAllowed,
  surveySchedulingConfig,
  locale,
}: ResponseOptionsCardProps) => {
  const { t } = useTranslation();
  const { toCalendarDate, getMinimumSurveySchedulingCalendarDate } = useMemo(
    () => createSurveySchedulingDateUtils(surveySchedulingConfig),
    [surveySchedulingConfig]
  );
  const surveySchedulingTimeLabel = getSurveySchedulingTimeLabel(surveySchedulingConfig);
  const surveySchedulingTimeZoneLabel = surveySchedulingConfig.timeZone;
  const [open, setOpen] = useState(localSurvey.type === "link");
  const autoComplete = localSurvey.autoComplete !== null;
  const [surveyClosedMessageToggle, setSurveyClosedMessageToggle] = useState(false);
  const [verifyEmailToggle, setVerifyEmailToggle] = useState(localSurvey.isVerifyEmailEnabled);
  const [recaptchaToggle, setRecaptchaToggle] = useState(localSurvey.recaptcha?.enabled ?? false);
  const [singleResponsePerEmailToggle, setSingleResponsePerEmailToggle] = useState(
    localSurvey.isSingleResponsePerEmailEnabled
  );
  const [captureIpToggle, setCaptureIpToggle] = useState(localSurvey.isCaptureIpEnabled);

  const [surveyClosedMessage, setSurveyClosedMessage] = useState({
    heading: t("workspace.surveys.edit.survey_completed_heading"),
    subheading: t("workspace.surveys.edit.survey_completed_subheading"),
  });

  const [recaptchaThreshold, setRecaptchaThreshold] = useState<number>(localSurvey.recaptcha?.threshold ?? 0);
  const publishOn = localSurvey.publishOn ? toCalendarDate(localSurvey.publishOn) : null;
  const closeOn = localSurvey.closeOn ? toCalendarDate(localSurvey.closeOn) : null;
  const minimumSchedulingDate = getMinimumSurveySchedulingCalendarDate();
  const minPublishDate = minimumSchedulingDate;
  const minCloseDate = (() => {
    if (!publishOn) {
      return minimumSchedulingDate;
    }

    const nextCalendarDay = new Date(publishOn);
    nextCalendarDay.setDate(nextCalendarDay.getDate() + 1);

    return nextCalendarDay.getTime() > minimumSchedulingDate.getTime()
      ? nextCalendarDay
      : minimumSchedulingDate;
  })();
  const isPublishOnDateEnabled = localSurvey.publishOn !== null;
  const isCloseOnDateEnabled = localSurvey.closeOn !== null;

  const isPinProtectionEnabled = localSurvey.pin !== null;

  const [verifyProtectWithPinError, setVerifyProtectWithPinError] = useState<string | null>(null);

  const handleProtectSurveyWithPinToggle = () => {
    setLocalSurvey((prevSurvey) => ({ ...prevSurvey, pin: isPinProtectionEnabled ? null : "1234" }));
  };

  const handleProtectSurveyPinChange = (pin: string) => {
    //check if pin only contains numbers
    const validation = /^\d+$/;
    const isValidPin = validation.test(pin);
    if (!isValidPin) return toast.error(t("workspace.surveys.edit.pin_can_only_contain_numbers"));
    setLocalSurvey({ ...localSurvey, pin });
  };

  const handleProtectSurveyPinBlurEvent = () => {
    if (!localSurvey.pin) return setVerifyProtectWithPinError(null);

    const regexPattern = /^\d{4}$/;
    const isValidPin = regexPattern.test(`${localSurvey.pin}`);

    if (!isValidPin)
      return setVerifyProtectWithPinError(t("workspace.surveys.edit.pin_must_be_a_four_digit_number"));
    setVerifyProtectWithPinError(null);
  };

  const handleSurveyPinInputKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    const exceptThisSymbols = ["e", "E", "+", "-", "."];
    if (exceptThisSymbols.includes(e.key)) e.preventDefault();
  };

  const handleCloseSurveyMessageToggle = () => {
    setSurveyClosedMessageToggle((prev) => !prev);

    if (surveyClosedMessageToggle && localSurvey.surveyClosedMessage) {
      setLocalSurvey({ ...localSurvey, surveyClosedMessage: null });
    }
  };

  const handleVerifyEmailToogle = () => {
    setVerifyEmailToggle(!verifyEmailToggle);
    setLocalSurvey({ ...localSurvey, isVerifyEmailEnabled: !localSurvey.isVerifyEmailEnabled });
  };

  const handleSingleResponsePerEmailToggle = () => {
    setSingleResponsePerEmailToggle(!singleResponsePerEmailToggle);
    setLocalSurvey({
      ...localSurvey,
      isSingleResponsePerEmailEnabled: !localSurvey.isSingleResponsePerEmailEnabled,
    });
  };

  const handleClosedSurveyMessageChange = ({
    heading,
    subheading,
  }: {
    heading?: string;
    subheading?: string;
  }) => {
    const message = {
      heading: heading ?? surveyClosedMessage.heading,
      subheading: subheading ?? surveyClosedMessage.subheading,
    };

    setSurveyClosedMessage(message);
    setLocalSurvey({ ...localSurvey, surveyClosedMessage: message });
  };

  const handleHideBackButtonToggle = () => {
    setLocalSurvey({ ...localSurvey, isBackButtonHidden: !localSurvey.isBackButtonHidden });
  };

  const handleAutoProgressToggle = () => {
    setLocalSurvey({ ...localSurvey, isAutoProgressingEnabled: !localSurvey.isAutoProgressingEnabled });
  };

  const handleCaptureIpToggle = () => {
    setCaptureIpToggle(!captureIpToggle);
    setLocalSurvey({ ...localSurvey, isCaptureIpEnabled: !localSurvey.isCaptureIpEnabled });
  };

  useEffect(() => {
    if (localSurvey.surveyClosedMessage) {
      setSurveyClosedMessage({
        heading: localSurvey.surveyClosedMessage.heading ?? surveyClosedMessage.heading,
        subheading: localSurvey.surveyClosedMessage.subheading ?? surveyClosedMessage.subheading,
      });
      setSurveyClosedMessageToggle(true);
    }
  }, [localSurvey, surveyClosedMessage.heading, surveyClosedMessage.subheading]);

  useEffect(() => {
    if (!publishOn || !closeOn) {
      return;
    }

    if (closeOn.getTime() > publishOn.getTime()) {
      return;
    }

    setLocalSurvey((currentSurvey) => {
      if (!currentSurvey.closeOn || !currentSurvey.publishOn) {
        return currentSurvey;
      }

      const currentCloseOn = toCalendarDate(currentSurvey.closeOn);
      const currentPublishOn = toCalendarDate(currentSurvey.publishOn);

      if (currentCloseOn.getTime() > currentPublishOn.getTime()) {
        return currentSurvey;
      }

      return {
        ...currentSurvey,
        closeOn: null,
      };
    });
  }, [closeOn, publishOn, setLocalSurvey, toCalendarDate]);

  const togglePublishOnDate = () => {
    if (isPublishOnDateEnabled) {
      setLocalSurvey((currentSurvey) => ({
        ...currentSurvey,
        publishOn: null,
      }));
      return;
    }

    const nextPublishOn = toDateOnlySelection(minPublishDate);
    const nextPublishCalendarDate = toCalendarDate(nextPublishOn);

    setLocalSurvey((currentSurvey) => ({
      ...currentSurvey,
      closeOn:
        currentSurvey.closeOn &&
        toCalendarDate(currentSurvey.closeOn).getTime() <= nextPublishCalendarDate.getTime()
          ? null
          : currentSurvey.closeOn,
      publishOn: nextPublishOn,
    }));
  };

  const toggleCloseOnDate = () => {
    if (isCloseOnDateEnabled) {
      setLocalSurvey((currentSurvey) => ({
        ...currentSurvey,
        closeOn: null,
      }));
      return;
    }

    setLocalSurvey((currentSurvey) => ({
      ...currentSurvey,
      closeOn: toDateOnlySelection(minCloseDate),
    }));
  };

  const toggleAutocomplete = () => {
    if (autoComplete) {
      const updatedSurvey = { ...localSurvey, autoComplete: null };
      setLocalSurvey(updatedSurvey);
    } else {
      const updatedSurvey = { ...localSurvey, autoComplete: Math.max(25, responseCount + 5) };
      setLocalSurvey(updatedSurvey);
    }
  };

  const handleInputResponse = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = Number.parseInt(e.target.value);
    if (Number.isNaN(value) || value < 1) {
      value = 1;
    }

    const updatedSurvey = { ...localSurvey, autoComplete: value };
    setLocalSurvey(updatedSurvey);
  };

  const handleInputResponseBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (Number.parseInt(e.target.value) === 0) {
      toast.error(t("workspace.surveys.edit.response_limit_can_t_be_set_to_0"));
      return;
    }

    if (Number.parseInt(e.target.value) <= responseCount) {
      toast.error(
        t("workspace.surveys.edit.response_limit_needs_to_exceed_number_of_received_responses", {
          responseCount,
        }),
        {
          id: "response-limit-error",
        }
      );
    }
  };

  const handleRecaptchaToggle = () => {
    if (!isSpamProtectionAllowed) return;
    if (recaptchaToggle) {
      setRecaptchaToggle(false);
      if (localSurvey.recaptcha?.enabled) {
        setRecaptchaThreshold(0.1);
        setLocalSurvey({ ...localSurvey, recaptcha: { enabled: false, threshold: 0.1 } });
      }
    } else {
      setRecaptchaToggle(true);
      setLocalSurvey({ ...localSurvey, recaptcha: { enabled: true, threshold: 0.1 } });
    }
  };

  const handleThresholdChange = (value: number) => {
    setRecaptchaThreshold(value);
    setLocalSurvey(
      (prevSurvey: TSurvey): TSurvey => ({
        ...prevSurvey,
        recaptcha: {
          enabled: prevSurvey.recaptcha?.enabled ?? false,
          threshold: value,
        },
      })
    );
  };

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        open ? "" : "hover:bg-slate-50",
        "w-full space-y-2 rounded-lg border border-slate-300 bg-white"
      )}>
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pr-5 pl-2">
            <CheckIcon
              strokeWidth={3}
              className="size-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
            />{" "}
          </div>
          <div>
            <p className="font-semibold text-slate-800">{t("workspace.surveys.edit.response_options")}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t("workspace.surveys.edit.response_limits_redirections_and_more")}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="flex flex-col overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          <AdvancedOptionToggle
            htmlId="publishSurveyOnDate"
            isChecked={isPublishOnDateEnabled}
            onToggle={togglePublishOnDate}
            title={t("workspace.surveys.edit.publish_survey_on_date")}
            description={t("workspace.surveys.edit.survey_will_be_published_at_midnight_cet", {
              time: surveySchedulingTimeLabel,
              timeZone: surveySchedulingTimeZoneLabel,
            })}
            childBorder={true}>
            <div className="p-4">
              <DatePicker
                clearButtonId="clear-publish-on-date"
                clearButtonLabel={t("workspace.surveys.edit.clear_publish_on_date")}
                date={publishOn}
                locale={locale}
                minDate={minPublishDate}
                onClearDate={() => {
                  setLocalSurvey((currentSurvey) => ({
                    ...currentSurvey,
                    publishOn: null,
                  }));
                }}
                updateSurveyDate={(date) => {
                  const nextPublishOn = toDateOnlySelection(date);
                  const nextPublishCalendarDate = toCalendarDate(nextPublishOn);

                  setLocalSurvey((currentSurvey) => ({
                    ...currentSurvey,
                    closeOn:
                      currentSurvey.closeOn &&
                      toCalendarDate(currentSurvey.closeOn).getTime() <= nextPublishCalendarDate.getTime()
                        ? null
                        : currentSurvey.closeOn,
                    publishOn: nextPublishOn,
                  }));
                }}
              />
            </div>
          </AdvancedOptionToggle>
          <AdvancedOptionToggle
            htmlId="closeSurveyOnDate"
            isChecked={isCloseOnDateEnabled}
            onToggle={toggleCloseOnDate}
            title={t("workspace.surveys.edit.close_survey_on_date")}
            description={t("workspace.surveys.edit.survey_will_be_closed_at_midnight_cet", {
              time: surveySchedulingTimeLabel,
              timeZone: surveySchedulingTimeZoneLabel,
            })}
            childBorder={true}>
            <div className="p-4">
              <DatePicker
                clearButtonId="clear-close-on-date"
                clearButtonLabel={t("workspace.surveys.edit.clear_close_on_date")}
                date={closeOn}
                locale={locale}
                minDate={minCloseDate}
                onClearDate={() => {
                  setLocalSurvey((currentSurvey) => ({
                    ...currentSurvey,
                    closeOn: null,
                  }));
                }}
                updateSurveyDate={(date) => {
                  setLocalSurvey((currentSurvey) => ({
                    ...currentSurvey,
                    closeOn: toDateOnlySelection(date),
                  }));
                }}
              />
            </div>
          </AdvancedOptionToggle>
          {/* Close Survey on Limit */}
          <AdvancedOptionToggle
            htmlId="closeOnNumberOfResponse"
            isChecked={autoComplete}
            onToggle={toggleAutocomplete}
            title={t("workspace.surveys.edit.close_survey_on_response_limit")}
            description={t(
              "workspace.surveys.edit.automatically_close_the_survey_after_a_certain_number_of_responses"
            )}
            childBorder={true}>
            <label htmlFor="autoCompleteResponses" className="cursor-pointer bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">
                <Trans
                  i18nKey="workspace.surveys.edit.automatically_mark_complete_after_n_responses"
                  components={{
                    autoCompleteInput: (
                      <Input
                        autoFocus
                        type="number"
                        min={responseCount ? (responseCount + 1).toString() : "1"}
                        id="autoCompleteResponses"
                        value={localSurvey.autoComplete?.toString()}
                        onChange={handleInputResponse}
                        onBlur={handleInputResponseBlur}
                        className="mr-2 ml-2 inline w-20 bg-white text-center text-sm"
                      />
                    ),
                  }}
                />
              </p>
            </label>
          </AdvancedOptionToggle>

          {/* recaptcha for spam protection */}
          {isSpamProtectionAllowed && (
            <AdvancedOptionToggle
              htmlId="recaptchaToggle"
              isChecked={recaptchaToggle}
              onToggle={handleRecaptchaToggle}
              title={t("workspace.surveys.edit.enable_spam_protection")}
              description={t("workspace.surveys.edit.enable_recaptcha_to_protect_your_survey_from_spam")}
              childBorder={true}>
              <div className="w-full px-2 py-4">
                <p className="text-sm font-semibold text-slate-800">
                  {t("workspace.surveys.edit.spam_protection_threshold_heading")} : {recaptchaThreshold}
                </p>
                <p className="mb-2 text-xs text-slate-500">
                  {t("workspace.surveys.edit.spam_protection_threshold_description")}
                </p>
                <div className="flex w-full items-center gap-1">
                  <div className="text-center">
                    <p className="mx-2">0.1</p>
                    <p className="mx-2 text-xs text-slate-500">Lenient</p>
                  </div>

                  <Slider
                    value={[recaptchaThreshold]}
                    className="grow"
                    max={0.9}
                    min={0.1}
                    step={0.1}
                    onValueChange={(value) => {
                      handleThresholdChange(value[0]);
                    }}
                  />
                  <div className="text-center">
                    <p className="mx-2">0.9</p>
                    <p className="mx-2 text-xs text-slate-500">Strict</p>
                  </div>
                </div>
                <Alert variant="warning" size="default" className="w-fill mt-2 text-sm">
                  <AlertTitle>{t("workspace.surveys.edit.spam_protection_note")}</AlertTitle>
                </Alert>
              </div>
            </AdvancedOptionToggle>
          )}

          {localSurvey.type === "link" && (
            <>
              {/* Adjust Survey Closed Message */}
              <AdvancedOptionToggle
                htmlId="adjustSurveyClosedMessage"
                isChecked={surveyClosedMessageToggle}
                onToggle={handleCloseSurveyMessageToggle}
                title={t("workspace.surveys.edit.adjust_survey_closed_message")}
                description={t("workspace.surveys.edit.adjust_survey_closed_message_description")}
                childBorder={true}>
                <div className="flex w-full items-center gap-x-1 p-4 pb-4">
                  <div className="w-full cursor-pointer items-center bg-slate-50">
                    <Label htmlFor="headline">{t("workspace.surveys.edit.heading")}</Label>
                    <Input
                      autoFocus
                      id="heading"
                      className="mt-2 mb-4 bg-white"
                      name="heading"
                      defaultValue={surveyClosedMessage.heading}
                      onChange={(e) => handleClosedSurveyMessageChange({ heading: e.target.value })}
                    />

                    <Label htmlFor="headline">{t("workspace.surveys.edit.subheading")}</Label>
                    <Input
                      className="mt-2 bg-white"
                      id="subheading"
                      name="subheading"
                      defaultValue={surveyClosedMessage.subheading}
                      onChange={(e) => handleClosedSurveyMessageChange({ subheading: e.target.value })}
                    />
                  </div>
                </div>
              </AdvancedOptionToggle>

              {/* Verify Email Section */}
              <AdvancedOptionToggle
                htmlId="verifyEmailBeforeSubmission"
                isChecked={verifyEmailToggle}
                onToggle={handleVerifyEmailToogle}
                title={t("workspace.surveys.edit.verify_email_before_submission")}
                description={t("workspace.surveys.edit.verify_email_before_submission_description")}
                childBorder={true}>
                <div className="m-1">
                  <AdvancedOptionToggle
                    htmlId="preventDoubleSubmission"
                    isChecked={singleResponsePerEmailToggle}
                    onToggle={handleSingleResponsePerEmailToggle}
                    title={t("workspace.surveys.edit.prevent_double_submission")}
                    description={t("workspace.surveys.edit.prevent_double_submission_description")}
                  />
                </div>
              </AdvancedOptionToggle>

              {/* Protect Survey with Pin */}
              <AdvancedOptionToggle
                htmlId="protectSurveyWithPin"
                isChecked={isPinProtectionEnabled}
                onToggle={handleProtectSurveyWithPinToggle}
                title={t("workspace.surveys.edit.protect_survey_with_pin")}
                description={t("workspace.surveys.edit.protect_survey_with_pin_description")}
                childBorder={true}>
                <div className="p-4">
                  <Label htmlFor="headline" className="sr-only">
                    {t("workspace.surveys.edit.add_pin")}
                  </Label>
                  <Input
                    autoFocus
                    id="pin"
                    isInvalid={Boolean(verifyProtectWithPinError)}
                    className="bg-white"
                    name="pin"
                    placeholder={t("workspace.surveys.edit.add_a_four_digit_pin")}
                    onBlur={handleProtectSurveyPinBlurEvent}
                    defaultValue={localSurvey.pin ? localSurvey.pin : undefined}
                    onKeyDown={handleSurveyPinInputKeyDown}
                    onChange={(e) => handleProtectSurveyPinChange(e.target.value)}
                    maxLength={4}
                  />
                  {verifyProtectWithPinError && (
                    <p className="pt-1 text-sm text-red-700">{verifyProtectWithPinError}</p>
                  )}
                </div>
              </AdvancedOptionToggle>
            </>
          )}
          <AdvancedOptionToggle
            htmlId="autoProgressRatingNps"
            isChecked={Boolean(localSurvey.isAutoProgressingEnabled)}
            onToggle={handleAutoProgressToggle}
            title={t("workspace.surveys.edit.auto_progress_rating_and_nps")}
            description={t("workspace.surveys.edit.auto_progress_rating_and_nps_description")}
          />
          <AdvancedOptionToggle
            htmlId="hideBackButton"
            isChecked={localSurvey.isBackButtonHidden}
            onToggle={handleHideBackButtonToggle}
            title={t("workspace.surveys.edit.hide_back_button")}
            description={t("workspace.surveys.edit.hide_back_button_description")}
          />
          <AdvancedOptionToggle
            htmlId="captureIp"
            isChecked={captureIpToggle}
            onToggle={handleCaptureIpToggle}
            title={t("workspace.surveys.edit.capture_ip_address")}
            description={t("workspace.surveys.edit.capture_ip_address_description")}
          />
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
