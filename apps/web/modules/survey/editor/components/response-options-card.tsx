"use client";

import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { DatePicker } from "@/modules/ui/components/date-picker";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useTranslate } from "@tolgee/react";
import { ArrowUpRight, CheckIcon } from "lucide-react";
import Link from "next/link";
import { KeyboardEventHandler, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@formbricks/lib/cn";
import { TSurvey } from "@formbricks/types/surveys/types";

interface ResponseOptionsCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey | ((TSurvey) => TSurvey)) => void;
  responseCount: number;
}

export const ResponseOptionsCard = ({
  localSurvey,
  setLocalSurvey,
  responseCount,
}: ResponseOptionsCardProps) => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(localSurvey.type === "link" ? true : false);
  const autoComplete = localSurvey.autoComplete !== null;
  const [runOnDateToggle, setRunOnDateToggle] = useState(false);
  const [closeOnDateToggle, setCloseOnDateToggle] = useState(false);
  useState;
  const [surveyClosedMessageToggle, setSurveyClosedMessageToggle] = useState(false);
  const [verifyEmailToggle, setVerifyEmailToggle] = useState(localSurvey.isVerifyEmailEnabled);
  const [isSingleResponsePerEmailEnabledToggle, setIsSingleResponsePerEmailToggle] = useState(
    localSurvey.isSingleResponsePerEmailEnabled
  );

  const [surveyClosedMessage, setSurveyClosedMessage] = useState({
    heading: t("environments.surveys.edit.survey_completed_heading"),
    subheading: t("environments.surveys.edit.survey_completed_subheading"),
  });

  const [singleUseMessage, setSingleUseMessage] = useState({
    heading: t("environments.surveys.edit.survey_already_answered_heading"),
    subheading: t("environments.surveys.edit.survey_already_answered_subheading"),
  });

  const [singleUseEncryption, setSingleUseEncryption] = useState(true);
  const [runOnDate, setRunOnDate] = useState<Date | null>(null);
  const [closeOnDate, setCloseOnDate] = useState<Date | null>(null);

  const isPinProtectionEnabled = localSurvey.pin !== null;

  const [verifyProtectWithPinError, setVerifyProtectWithPinError] = useState<string | null>(null);

  const handleRunOnDateToggle = () => {
    if (runOnDateToggle) {
      setRunOnDateToggle(false);
      if (localSurvey.runOnDate) {
        setRunOnDate(null);
        setLocalSurvey({ ...localSurvey, runOnDate: null });
      }
    } else {
      setRunOnDateToggle(true);
    }
  };

  const handleCloseOnDateToggle = () => {
    if (closeOnDateToggle) {
      setCloseOnDateToggle(false);
      if (localSurvey.closeOnDate) {
        setCloseOnDate(null);
        setLocalSurvey({ ...localSurvey, closeOnDate: null });
      }
    } else {
      setCloseOnDateToggle(true);
    }
  };

  const handleProtectSurveyWithPinToggle = () => {
    setLocalSurvey((prevSurvey) => ({ ...prevSurvey, pin: isPinProtectionEnabled ? null : "1234" }));
  };

  const handleProtectSurveyPinChange = (pin: string) => {
    //check if pin only contains numbers
    const validation = /^\d+$/;
    const isValidPin = validation.test(pin);
    if (!isValidPin) return toast.error(t("environments.surveys.edit.pin_can_only_contain_numbers"));
    setLocalSurvey({ ...localSurvey, pin });
  };

  const handleProtectSurveyPinBlurEvent = () => {
    if (!localSurvey.pin) return setVerifyProtectWithPinError(null);

    const regexPattern = /^\d{4}$/;
    const isValidPin = regexPattern.test(`${localSurvey.pin}`);

    if (!isValidPin)
      return setVerifyProtectWithPinError(t("environments.surveys.edit.pin_must_be_a_four_digit_number"));
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
    setIsSingleResponsePerEmailToggle(!isSingleResponsePerEmailEnabledToggle);
    setLocalSurvey({
      ...localSurvey,
      isSingleResponsePerEmailEnabled: !localSurvey.isSingleResponsePerEmailEnabled,
    });
  };

  const handleRunOnDateChange = (date: Date) => {
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
    setRunOnDate(utcDate);
    setLocalSurvey({ ...localSurvey, runOnDate: utcDate ?? null });
  };

  const handleCloseOnDateChange = (date: Date) => {
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
    setCloseOnDate(utcDate);
    setLocalSurvey({ ...localSurvey, closeOnDate: utcDate ?? null });
  };

  const handleClosedSurveyMessageChange = ({
    heading,
    subheading,
  }: {
    heading?: string;
    subheading?: string;
  }) => {
    const message = {
      enabled: closeOnDateToggle,
      heading: heading ?? surveyClosedMessage.heading,
      subheading: subheading ?? surveyClosedMessage.subheading,
    };

    setSurveyClosedMessage(message);
    setLocalSurvey({ ...localSurvey, surveyClosedMessage: message });
  };

  const handleSingleUseSurveyToggle = () => {
    if (!localSurvey.singleUse?.enabled) {
      setLocalSurvey({
        ...localSurvey,
        singleUse: { enabled: true, ...singleUseMessage, isEncrypted: singleUseEncryption },
      });
    } else {
      setLocalSurvey({ ...localSurvey, singleUse: { enabled: false, isEncrypted: false } });
    }
  };

  const handleSingleUseSurveyMessageChange = ({
    heading,
    subheading,
  }: {
    heading?: string;
    subheading?: string;
  }) => {
    const message = {
      heading: heading ?? singleUseMessage.heading,
      subheading: subheading ?? singleUseMessage.subheading,
    };

    const localSurveySingleUseEnabled = localSurvey.singleUse?.enabled ?? false;
    setSingleUseMessage(message);
    setLocalSurvey({
      ...localSurvey,
      singleUse: { enabled: localSurveySingleUseEnabled, ...message, isEncrypted: singleUseEncryption },
    });
  };

  const hangleSingleUseEncryptionToggle = () => {
    if (!singleUseEncryption) {
      setSingleUseEncryption(true);
      setLocalSurvey({
        ...localSurvey,
        singleUse: { enabled: true, ...singleUseMessage, isEncrypted: true },
      });
    } else {
      setSingleUseEncryption(false);
      setLocalSurvey({
        ...localSurvey,
        singleUse: { enabled: true, ...singleUseMessage, isEncrypted: false },
      });
    }
  };

  const handleHideBackButtonToggle = () => {
    setLocalSurvey({ ...localSurvey, isBackButtonHidden: !localSurvey.isBackButtonHidden });
  };

  const handleIsCaptureIPAddressEnabledToggle = () => {
    setLocalSurvey({ ...localSurvey, isCaptureIPAddressEnabled: !localSurvey.isCaptureIPAddressEnabled });
  };

  useEffect(() => {
    if (!!localSurvey.surveyClosedMessage) {
      setSurveyClosedMessage({
        heading: localSurvey.surveyClosedMessage.heading ?? surveyClosedMessage.heading,
        subheading: localSurvey.surveyClosedMessage.subheading ?? surveyClosedMessage.subheading,
      });
      setSurveyClosedMessageToggle(true);
    }

    if (localSurvey.singleUse?.enabled) {
      setSingleUseMessage({
        heading: localSurvey.singleUse.heading ?? singleUseMessage.heading,
        subheading: localSurvey.singleUse.subheading ?? singleUseMessage.subheading,
      });
      setSingleUseEncryption(localSurvey.singleUse.isEncrypted);
    }

    if (localSurvey.runOnDate) {
      setRunOnDate(localSurvey.runOnDate);
      setRunOnDateToggle(true);
    }

    if (localSurvey.closeOnDate) {
      setCloseOnDate(localSurvey.closeOnDate);
      setCloseOnDateToggle(true);
    }
  }, [
    localSurvey,
    singleUseMessage.heading,
    singleUseMessage.subheading,
    surveyClosedMessage.heading,
    surveyClosedMessage.subheading,
  ]);

  const toggleAutocomplete = () => {
    if (autoComplete) {
      const updatedSurvey = { ...localSurvey, autoComplete: null };
      setLocalSurvey(updatedSurvey);
    } else {
      const updatedSurvey = { ...localSurvey, autoComplete: Math.max(25, responseCount + 5) };
      setLocalSurvey(updatedSurvey);
    }
  };

  const handleInputResponse = (e) => {
    let value = parseInt(e.target.value);
    if (Number.isNaN(value) || value < 1) {
      value = 1;
    }

    const updatedSurvey = { ...localSurvey, autoComplete: value };
    setLocalSurvey(updatedSurvey);
  };

  const handleInputResponseBlur = (e) => {
    if (parseInt(e.target.value) === 0) {
      toast.error(t("environments.surveys.edit.response_limit_can_t_be_set_to_0"));
      return;
    }

    if (parseInt(e.target.value) <= responseCount) {
      toast.error(
        t("environments.surveys.edit.response_limit_needs_to_exceed_number_of_received_responses", {
          responseCount,
        })
      );
      return;
    }
  };
  const [parent] = useAutoAnimate();

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
              className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
            />{" "}
          </div>
          <div>
            <p className="font-semibold text-slate-800">{t("environments.surveys.edit.response_options")}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t("environments.surveys.edit.response_limits_redirections_and_more")}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="flex flex-col" ref={parent}>
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          {/* Close Survey on Limit */}
          <AdvancedOptionToggle
            htmlId="closeOnNumberOfResponse"
            isChecked={autoComplete}
            onToggle={toggleAutocomplete}
            title={t("environments.surveys.edit.close_survey_on_response_limit")}
            description={t(
              "environments.surveys.edit.automatically_close_the_survey_after_a_certain_number_of_responses"
            )}
            childBorder={true}>
            <label htmlFor="autoCompleteResponses" className="cursor-pointer bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">
                {t("environments.surveys.edit.automatically_mark_the_survey_as_complete_after")}
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
                {t("environments.surveys.edit.completed_responses")}
              </p>
            </label>
          </AdvancedOptionToggle>
          {/* Run Survey on Date */}
          <AdvancedOptionToggle
            htmlId="runOnDate"
            isChecked={runOnDateToggle}
            onToggle={handleRunOnDateToggle}
            title={t("environments.surveys.edit.release_survey_on_date")}
            description={t(
              "environments.surveys.edit.automatically_release_the_survey_at_the_beginning_of_the_day_utc"
            )}
            childBorder={true}>
            <div className="p-4">
              <DatePicker date={runOnDate} updateSurveyDate={handleRunOnDateChange} />
            </div>
          </AdvancedOptionToggle>
          {/* Close Survey on Date */}
          <AdvancedOptionToggle
            htmlId="closeOnDate"
            isChecked={closeOnDateToggle}
            onToggle={handleCloseOnDateToggle}
            title={t("environments.surveys.edit.close_survey_on_date")}
            description={t(
              "environments.surveys.edit.automatically_closes_the_survey_at_the_beginning_of_the_day_utc"
            )}
            childBorder={true}>
            <div className="p-4">
              <DatePicker date={closeOnDate} updateSurveyDate={handleCloseOnDateChange} />
            </div>
          </AdvancedOptionToggle>

          {localSurvey.type === "link" && (
            <>
              {/* Adjust Survey Closed Message */}
              <AdvancedOptionToggle
                htmlId="adjustSurveyClosedMessage"
                isChecked={surveyClosedMessageToggle}
                onToggle={handleCloseSurveyMessageToggle}
                title={t("environments.surveys.edit.adjust_survey_closed_message")}
                description={t("environments.surveys.edit.adjust_survey_closed_message_description")}
                childBorder={true}>
                <div className="flex w-full items-center space-x-1 p-4 pb-4">
                  <div className="w-full cursor-pointer items-center bg-slate-50">
                    <Label htmlFor="headline">{t("environments.surveys.edit.heading")}</Label>
                    <Input
                      autoFocus
                      id="heading"
                      className="mt-2 mb-4 bg-white"
                      name="heading"
                      defaultValue={surveyClosedMessage.heading}
                      onChange={(e) => handleClosedSurveyMessageChange({ heading: e.target.value })}
                    />

                    <Label htmlFor="headline">{t("environments.surveys.edit.subheading")}</Label>
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

              {/* Single User Survey Options */}
              <AdvancedOptionToggle
                htmlId="singleUserSurveyOptions"
                isChecked={!!localSurvey.singleUse?.enabled}
                onToggle={handleSingleUseSurveyToggle}
                title={t("environments.surveys.edit.single_use_survey_links")}
                description={t("environments.surveys.edit.single_use_survey_links_description")}
                childBorder={true}>
                <div className="flex w-full items-center space-x-1 p-4 pb-4">
                  <div className="w-full cursor-pointer items-center bg-slate-50">
                    <div className="row mb-2 flex cursor-default items-center space-x-2">
                      <Label htmlFor="howItWorks">{t("environments.surveys.edit.how_it_works")}</Label>
                    </div>
                    <ul className="mb-3 ml-4 cursor-default list-inside list-disc space-y-1">
                      <li className="text-sm text-slate-600">
                        {t(
                          "environments.surveys.edit.blocks_survey_if_the_survey_url_has_no_single_use_id_suid"
                        )}
                      </li>
                      <li className="text-sm text-slate-600">
                        {t(
                          "environments.surveys.edit.blocks_survey_if_a_submission_with_the_single_use_id_suid_exists_already"
                        )}
                      </li>
                      <li className="text-sm text-slate-600">
                        <Link
                          href="https://formbricks.com/docs/link-surveys/single-use-links"
                          target="_blank"
                          className="underline">
                          {t("common.read_docs")} <ArrowUpRight className="inline" size={16} />
                        </Link>
                      </li>
                    </ul>
                    <Label htmlFor="headline">{t("environments.surveys.edit.link_used_message")}</Label>
                    <Input
                      autoFocus
                      id="heading"
                      className="mt-2 mb-4 bg-white"
                      name="heading"
                      value={singleUseMessage.heading}
                      onChange={(e) => handleSingleUseSurveyMessageChange({ heading: e.target.value })}
                    />

                    <Label htmlFor="headline">{t("environments.surveys.edit.subheading")}</Label>
                    <Input
                      className="mt-2 mb-4 bg-white"
                      id="subheading"
                      name="subheading"
                      value={singleUseMessage.subheading}
                      onChange={(e) => handleSingleUseSurveyMessageChange({ subheading: e.target.value })}
                    />
                    <Label htmlFor="headline">{t("environments.surveys.edit.url_encryption")}</Label>
                    <div>
                      <div className="mt-2 flex items-center space-x-1">
                        <Switch
                          id="encryption-switch"
                          checked={singleUseEncryption}
                          onCheckedChange={hangleSingleUseEncryptionToggle}
                        />
                        <Label htmlFor="encryption-label">
                          <div className="ml-2">
                            <p className="text-sm font-normal text-slate-600">
                              {t(
                                "environments.surveys.edit.enable_encryption_of_single_use_id_suid_in_survey_url"
                              )}
                            </p>
                          </div>
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </AdvancedOptionToggle>

              {/* Verify Email Section */}
              <AdvancedOptionToggle
                htmlId="verifyEmailBeforeSubmission"
                isChecked={verifyEmailToggle}
                onToggle={handleVerifyEmailToogle}
                title={t("environments.surveys.edit.verify_email_before_submission")}
                description={t("environments.surveys.edit.verify_email_before_submission_description")}
                childBorder={true}>
                <div className="m-1">
                  <AdvancedOptionToggle
                    htmlId="preventDoubleSubmission"
                    isChecked={isSingleResponsePerEmailEnabledToggle}
                    onToggle={handleSingleResponsePerEmailToggle}
                    title={t("environments.surveys.edit.prevent_double_submission")}
                    description={t("environments.surveys.edit.prevent_double_submission_description")}
                  />
                </div>
              </AdvancedOptionToggle>
              <AdvancedOptionToggle
                htmlId="protectSurveyWithPin"
                isChecked={isPinProtectionEnabled}
                onToggle={handleProtectSurveyWithPinToggle}
                title={t("environments.surveys.edit.protect_survey_with_pin")}
                description={t("environments.surveys.edit.protect_survey_with_pin_description")}
                childBorder={true}>
                <div className="p-4">
                  <Label htmlFor="headline" className="sr-only">
                    {t("environments.surveys.edit.add_pin")}
                  </Label>
                  <Input
                    autoFocus
                    id="pin"
                    isInvalid={Boolean(verifyProtectWithPinError)}
                    className="bg-white"
                    name="pin"
                    placeholder={t("environments.surveys.edit.add_a_four_digit_pin")}
                    onBlur={handleProtectSurveyPinBlurEvent}
                    defaultValue={localSurvey.pin ? localSurvey.pin : undefined}
                    onKeyDown={handleSurveyPinInputKeyDown}
                    onChange={(e) => handleProtectSurveyPinChange(e.target.value)}
                  />
                  {verifyProtectWithPinError && (
                    <p className="pt-1 text-sm text-red-700">{verifyProtectWithPinError}</p>
                  )}
                </div>
              </AdvancedOptionToggle>
            </>
          )}
          <AdvancedOptionToggle
            htmlId="hideBackButton"
            isChecked={localSurvey.isBackButtonHidden}
            onToggle={handleHideBackButtonToggle}
            title={t("environments.surveys.edit.hide_back_button")}
            description={t("environments.surveys.edit.hide_back_button_description")}
          />
          <AdvancedOptionToggle
            htmlId="captureIPAddressButton"
            isChecked={localSurvey.isCaptureIPAddressEnabled}
            onToggle={handleIsCaptureIPAddressEnabledToggle}
            title={t("environments.surveys.edit.capture_ip_address_of_respondent")}
            description={t("environments.surveys.edit.capture_ip_address_of_respondent_description")}
          />
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
