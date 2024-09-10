"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import { KeyboardEventHandler, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@formbricks/lib/cn";
import { TSurvey } from "@formbricks/types/surveys/types";
import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
import { DatePicker } from "@formbricks/ui/DatePicker";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";

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
  const [open, setOpen] = useState(localSurvey.type === "link" ? true : false);
  const autoComplete = localSurvey.autoComplete !== null;
  const [runOnDateToggle, setRunOnDateToggle] = useState(false);
  const [closeOnDateToggle, setCloseOnDateToggle] = useState(false);
  useState;
  const [surveyClosedMessageToggle, setSurveyClosedMessageToggle] = useState(false);
  const [surveyLinkUsedMessageToggle, setSurveyLinkUsedMessageToggle] = useState(false);
  const [verifyEmailToggle, setVerifyEmailToggle] = useState(localSurvey.isVerifyEmailEnabled);
  const [isSingleResponsePerEmailEnabledToggle, setIsSingleResponsePerEmailToggle] = useState(
    localSurvey.isSingleResponsePerEmailEnabled
  );

  const [surveyClosedMessage, setSurveyClosedMessage] = useState({
    heading: "Survey Completed",
    subheading: "This free & open-source survey has been closed",
  });

  const [singleUseMessage, setSingleUseMessage] = useState({
    heading: "The survey has already been answered.",
    subheading: "You can only use this link once.",
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
    if (!isValidPin) return toast.error("PIN can only contain numbers");
    setLocalSurvey({ ...localSurvey, pin });
  };

  const handleProtectSurveyPinBlurEvent = () => {
    if (!localSurvey.pin) return setVerifyProtectWithPinError(null);

    const regexPattern = /^\d{4}$/;
    const isValidPin = regexPattern.test(`${localSurvey.pin}`);

    if (!isValidPin) return setVerifyProtectWithPinError("PIN must be a four digit number.");
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

  const handleSurveyLinkUsedMessageToggle = () => {
    setSurveyLinkUsedMessageToggle((prev) => !prev);

    setLocalSurvey({ ...localSurvey, singleUse: { enabled: true, isEncrypted: true } });
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
    const equivalentDate = date?.getDate();
    date?.setUTCHours(0, 0, 0, 0);
    date?.setDate(equivalentDate);

    setRunOnDate(date);
    setLocalSurvey({ ...localSurvey, runOnDate: date ?? null });
  };

  const handleCloseOnDateChange = (date: Date) => {
    const equivalentDate = date?.getDate();
    date?.setUTCHours(0, 0, 0, 0);
    date?.setDate(equivalentDate);

    setCloseOnDate(date);
    setLocalSurvey({ ...localSurvey, closeOnDate: date ?? null });
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
      toast.error("Response limit can't be set to 0");
      return;
    }

    if (parseInt(e.target.value) <= responseCount) {
      toast.error(`Response limit needs to exceed number of received responses (${responseCount}).`);
      return;
    }
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
          <div className="flex items-center pl-2 pr-5">
            <CheckIcon
              strokeWidth={3}
              className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
            />{" "}
          </div>
          <div>
            <p className="font-semibold text-slate-800">Response Options</p>
            <p className="mt-1 text-sm text-slate-500">Response limits, redirections and more.</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          {/* Close Survey on Limit */}
          <AdvancedOptionToggle
            htmlId="closeOnNumberOfResponse"
            isChecked={autoComplete}
            onToggle={toggleAutocomplete}
            title="Close survey on response limit"
            description="Automatically close the survey after a certain number of responses."
            childBorder={true}>
            <label htmlFor="autoCompleteResponses" className="cursor-pointer bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">
                Automatically mark the survey as complete after
                <Input
                  autoFocus
                  type="number"
                  min={responseCount ? (responseCount + 1).toString() : "1"}
                  id="autoCompleteResponses"
                  value={localSurvey.autoComplete?.toString()}
                  onChange={handleInputResponse}
                  onBlur={handleInputResponseBlur}
                  className="ml-2 mr-2 inline w-20 bg-white text-center text-sm"
                />
                completed responses.
              </p>
            </label>
          </AdvancedOptionToggle>
          {/* Run Survey on Date */}
          <AdvancedOptionToggle
            htmlId="runOnDate"
            isChecked={runOnDateToggle}
            onToggle={handleRunOnDateToggle}
            title="Release survey on date"
            description="Automatically release the survey at the beginning of the day (UTC)."
            childBorder={true}>
            <div className="p-4">
              <DatePicker date={runOnDate} handleDateChange={handleRunOnDateChange} />
            </div>
          </AdvancedOptionToggle>
          {/* Close Survey on Date */}
          <AdvancedOptionToggle
            htmlId="closeOnDate"
            isChecked={closeOnDateToggle}
            onToggle={handleCloseOnDateToggle}
            title="Close survey on date"
            description="Automatically closes the survey at the beginning of the day (UTC)."
            childBorder={true}>
            <div className="p-4">
              <DatePicker date={closeOnDate} handleDateChange={handleCloseOnDateChange} />
            </div>
          </AdvancedOptionToggle>

          {localSurvey.type === "link" && (
            <>
              {/* Adjust Survey Closed Message */}
              <AdvancedOptionToggle
                htmlId="adjustSurveyClosedMessage"
                isChecked={surveyClosedMessageToggle}
                onToggle={handleCloseSurveyMessageToggle}
                title="Adjust 'Survey Closed' message"
                description="Change the message visitors see when the survey is closed."
                childBorder={true}>
                <div className="flex w-full items-center space-x-1 p-4 pb-4">
                  <div className="w-full cursor-pointer items-center bg-slate-50">
                    <Label htmlFor="headline">Heading</Label>
                    <Input
                      autoFocus
                      id="heading"
                      className="mb-4 mt-2 bg-white"
                      name="heading"
                      defaultValue={surveyClosedMessage.heading}
                      onChange={(e) => handleClosedSurveyMessageChange({ heading: e.target.value })}
                    />

                    <Label htmlFor="headline">Subheading</Label>
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

              {/* Adjust Survey Link Used Message */}
              <AdvancedOptionToggle
                htmlId="adjustSurveyLinkUsedMessage"
                isChecked={surveyLinkUsedMessageToggle}
                onToggle={handleSurveyLinkUsedMessageToggle}
                title="Adjust 'Survey Used' message"
                description="Change the message visitors see when the survey has been already used."
                childBorder={true}>
                <div className="flex w-full items-center space-x-1 p-4 pb-4">
                  <div className="w-full cursor-pointer items-center bg-slate-50">
                    <Label htmlFor="headline">‘Link Used’ Message</Label>
                    <Input
                      autoFocus
                      id="heading"
                      className="mb-4 mt-2 bg-white"
                      name="heading"
                      defaultValue={singleUseMessage.heading}
                      onChange={(e) => handleSingleUseSurveyMessageChange({ heading: e.target.value })}
                    />

                    <Label htmlFor="headline">Subheading</Label>
                    <Input
                      className="mt-2 bg-white"
                      id="subheading"
                      name="subheading"
                      defaultValue={singleUseMessage.subheading}
                      onChange={(e) => handleSingleUseSurveyMessageChange({ subheading: e.target.value })}
                    />
                  </div>
                </div>
              </AdvancedOptionToggle>

              {/* Verify Email Section */}
              <AdvancedOptionToggle
                htmlId="verifyEmailBeforeSubmission"
                isChecked={verifyEmailToggle}
                onToggle={handleVerifyEmailToogle}
                title="Verify email before submission"
                description="Only let people with a real email respond."
                childBorder={true}>
                <div className="m-1">
                  <AdvancedOptionToggle
                    htmlId="preventDoubleSubmission"
                    isChecked={isSingleResponsePerEmailEnabledToggle}
                    onToggle={handleSingleResponsePerEmailToggle}
                    title="Prevent double submission"
                    description={"Only allow 1 response per email address"}
                  />
                </div>
              </AdvancedOptionToggle>
              <AdvancedOptionToggle
                htmlId="protectSurveyWithPin"
                isChecked={isPinProtectionEnabled}
                onToggle={handleProtectSurveyWithPinToggle}
                title="Protect survey with a PIN"
                description="Only users who have the PIN can access the survey."
                childBorder={true}>
                <div className="p-4">
                  <Label htmlFor="headline" className="sr-only">
                    Add PIN:
                  </Label>
                  <Input
                    autoFocus
                    id="pin"
                    isInvalid={Boolean(verifyProtectWithPinError)}
                    className="bg-white"
                    name="pin"
                    placeholder="Add a four digit PIN"
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
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
