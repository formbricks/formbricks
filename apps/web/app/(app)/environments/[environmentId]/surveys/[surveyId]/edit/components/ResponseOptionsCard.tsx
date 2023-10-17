"use client";

import { TSurvey } from "@formbricks/types/v1/surveys";
import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
import { DatePicker } from "@formbricks/ui/DatePicker";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { KeyboardEventHandler, useEffect, useState } from "react";
import toast from "react-hot-toast";

interface ResponseOptionsCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey | ((TSurvey) => TSurvey)) => void;
  isEncryptionKeySet: boolean;
  responseCount: number;
}

export default function ResponseOptionsCard({
  localSurvey,
  setLocalSurvey,
  isEncryptionKeySet,
  responseCount,
}: ResponseOptionsCardProps) {
  const [open, setOpen] = useState(false);
  const autoComplete = localSurvey.autoComplete !== null;
  const [redirectToggle, setRedirectToggle] = useState(false);
  const [surveyCloseOnDateToggle, setSurveyCloseOnDateToggle] = useState(false);
  useState;
  const [redirectUrl, setRedirectUrl] = useState<string | null>("");
  const [surveyClosedMessageToggle, setSurveyClosedMessageToggle] = useState(false);
  const [verifyEmailToggle, setVerifyEmailToggle] = useState(false);

  const [surveyClosedMessage, setSurveyClosedMessage] = useState({
    heading: "Survey Completed",
    subheading: "This free & open-source survey has been closed",
  });

  const [singleUseMessage, setSingleUseMessage] = useState({
    heading: "The survey has already been answered.",
    subheading: "You can only use this link once.",
  });

  const [singleUseEncryption, setSingleUseEncryption] = useState(isEncryptionKeySet);
  const [verifyEmailSurveyDetails, setVerifyEmailSurveyDetails] = useState({
    name: "",
    subheading: "",
  });
  const [closeOnDate, setCloseOnDate] = useState<Date>();

  const isPinProtectionEnabled = localSurvey.pin !== null;

  const [verifyProtectWithPinError, setverifyProtectWithPinError] = useState<string | null>(null);

  const handleRedirectCheckMark = () => {
    setRedirectToggle((prev) => !prev);

    if (redirectToggle && localSurvey.redirectUrl) {
      setRedirectUrl(null);
      setLocalSurvey({ ...localSurvey, redirectUrl: null });
    }
  };

  const handleSurveyCloseOnDateToggle = () => {
    if (surveyCloseOnDateToggle && localSurvey.closeOnDate) {
      setSurveyCloseOnDateToggle(false);
      setCloseOnDate(undefined);
      setLocalSurvey({ ...localSurvey, closeOnDate: null });
      return;
    }

    if (surveyCloseOnDateToggle) {
      setSurveyCloseOnDateToggle(false);
      return;
    }
    setSurveyCloseOnDateToggle(true);
  };

  const handleProtectSurveyWithPinToggle = () => {
    setLocalSurvey((prevSurvey) => ({ ...prevSurvey, pin: isPinProtectionEnabled ? null : 1234 }));
  };

  const handleProtectSurveyPinChange = (pin: string) => {
    const pinAsNumber = Number(pin);

    if (isNaN(pinAsNumber)) return toast.error("PIN can only contain numbers");
    setLocalSurvey({ ...localSurvey, pin: pinAsNumber });
  };

  const handleProtectSurveyPinBlurEvent = () => {
    if (!localSurvey.pin) return setverifyProtectWithPinError(null);

    const regexPattern = /^\d{4}$/;
    const isValidPin = regexPattern.test(`${localSurvey.pin}`);

    if (!isValidPin) return setverifyProtectWithPinError("PIN must be a four digit number.");
    setverifyProtectWithPinError(null);
  };

  const handleSurveyPinInputKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    const exceptThisSymbols = ["e", "E", "+", "-", "."];
    if (exceptThisSymbols.includes(e.key)) e.preventDefault();
  };

  const handleRedirectUrlChange = (link: string) => {
    setRedirectUrl(link);
    setLocalSurvey({ ...localSurvey, redirectUrl: link });
  };

  const handleCloseSurveyMessageToggle = () => {
    setSurveyClosedMessageToggle((prev) => !prev);

    if (surveyClosedMessageToggle && localSurvey.surveyClosedMessage) {
      setLocalSurvey({ ...localSurvey, surveyClosedMessage: null });
    }
  };

  const handleVerifyEmailToogle = () => {
    setVerifyEmailToggle((prev) => !prev);

    if (verifyEmailToggle && localSurvey.verifyEmail) {
      setLocalSurvey({ ...localSurvey, verifyEmail: null });
    }
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
      enabled: surveyCloseOnDateToggle,
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

  const handleVerifyEmailSurveyDetailsChange = ({
    name,
    subheading,
  }: {
    name?: string;
    subheading?: string;
  }) => {
    const message = {
      name: name || verifyEmailSurveyDetails.name,
      subheading: subheading || verifyEmailSurveyDetails.subheading,
    };

    setVerifyEmailSurveyDetails(message);
    setLocalSurvey({ ...localSurvey, verifyEmail: message });
  };

  useEffect(() => {
    if (localSurvey.redirectUrl) {
      setRedirectUrl(localSurvey.redirectUrl);
      setRedirectToggle(true);
    }

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

    if (localSurvey.verifyEmail) {
      setVerifyEmailSurveyDetails({
        name: localSurvey.verifyEmail.name!,
        subheading: localSurvey.verifyEmail.subheading!,
      });
      setVerifyEmailToggle(true);
    }

    if (localSurvey.closeOnDate) {
      setCloseOnDate(localSurvey.closeOnDate);
      setSurveyCloseOnDateToggle(true);
    }
  }, [localSurvey]);

  const handleCheckMark = () => {
    if (autoComplete) {
      const updatedSurvey = { ...localSurvey, autoComplete: null };
      setLocalSurvey(updatedSurvey);
    } else {
      const updatedSurvey = { ...localSurvey, autoComplete: 25 };
      setLocalSurvey(updatedSurvey);
    }
  };

  const handleInputResponse = (e) => {
    const updatedSurvey = { ...localSurvey, autoComplete: parseInt(e.target.value) };
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
      className="w-full rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckCircleIcon className="h-8 w-8 text-green-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Response Options</p>
            <p className="mt-1 text-sm text-slate-500">Decide how and how long people can respond.</p>
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
            onToggle={handleCheckMark}
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
          {/* Close Survey on Date */}
          <AdvancedOptionToggle
            htmlId="closeOnDate"
            isChecked={surveyCloseOnDateToggle}
            onToggle={handleSurveyCloseOnDateToggle}
            title="Close survey on date"
            description="Automatically closes the survey at the beginning of the day (UTC)."
            childBorder={true}>
            <div className="flex cursor-pointer p-4">
              <p className="mr-2 mt-3 text-sm font-semibold text-slate-700">
                Automatically mark survey as complete on:
              </p>
              <DatePicker date={closeOnDate} handleDateChange={handleCloseOnDateChange} />
            </div>
          </AdvancedOptionToggle>

          {/* Redirect on completion */}
          <AdvancedOptionToggle
            htmlId="redirectUrl"
            isChecked={redirectToggle}
            onToggle={handleRedirectCheckMark}
            title="Redirect on completion"
            description="Redirect user to specified link on survey completion"
            childBorder={true}>
            <div className="w-full p-4">
              <div className="flex w-full cursor-pointer items-center">
                <p className="mr-2 w-[400px] text-sm font-semibold text-slate-700">
                  Redirect respondents here:
                </p>
                <Input
                  autoFocus
                  className="w-full bg-white"
                  type="url"
                  placeholder="https://www.example.com"
                  value={redirectUrl ? redirectUrl : ""}
                  onChange={(e) => handleRedirectUrlChange(e.target.value)}
                />
              </div>
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
                  <div className="w-full cursor-pointer items-center  bg-slate-50">
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

              {/* Single User Survey Options */}
              <AdvancedOptionToggle
                htmlId="singleUserSurveyOptions"
                isChecked={!!localSurvey.singleUse?.enabled}
                onToggle={handleSingleUseSurveyToggle}
                title="Single-Use Survey Links"
                description="Allow only 1 response per survey link."
                childBorder={true}>
                <div className="flex w-full items-center space-x-1 p-4 pb-4">
                  <div className="w-full cursor-pointer items-center  bg-slate-50">
                    <div className="row mb-2 flex cursor-default items-center space-x-2">
                      <Label htmlFor="howItWorks">How it works</Label>
                    </div>
                    <ul className="mb-3 ml-4 cursor-default list-inside list-disc space-y-1">
                      <li className="text-sm text-slate-600">
                        Blocks survey if the survey URL has no Single Use Id (suId).
                      </li>
                      <li className="text-sm text-slate-600">
                        Blocks survey if a submission with the Single Use Id (suId) in the URL exists already.
                      </li>
                    </ul>
                    <Label htmlFor="headline">&lsquo;Link Used&rsquo; Message</Label>
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
                      className="mb-4 mt-2 bg-white"
                      id="subheading"
                      name="subheading"
                      defaultValue={singleUseMessage.subheading}
                      onChange={(e) => handleSingleUseSurveyMessageChange({ subheading: e.target.value })}
                    />
                    <Label htmlFor="headline">URL Encryption</Label>
                    <div>
                      <TooltipProvider delayDuration={50}>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="mt-2 flex items-center space-x-1 ">
                              <Switch
                                id="encryption-switch"
                                checked={singleUseEncryption}
                                onCheckedChange={hangleSingleUseEncryptionToggle}
                                disabled={!isEncryptionKeySet}
                              />
                              <Label htmlFor="encryption-label">
                                <div className="ml-2">
                                  <p className="text-sm font-normal text-slate-600">
                                    Enable encryption of Single Use Id (suId) in survey URL.
                                  </p>
                                </div>
                              </Label>
                            </div>
                          </TooltipTrigger>
                          {!isEncryptionKeySet && (
                            <TooltipContent side={"top"}>
                              <p className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">
                                FORMBRICKS_ENCRYPTION_KEY needs to be set to enable this feature.
                              </p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
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
                <div className="flex w-full items-center space-x-1 p-4 pb-4">
                  <div className="w-full cursor-pointer items-center  bg-slate-50">
                    <p className="text-md font-semibold">How it works</p>
                    <p className="mb-4 mt-2 text-sm text-slate-500">
                      Respondants will receive the survey link via email.
                    </p>
                    <Label htmlFor="headline">Survey Name (Public)</Label>
                    <Input
                      autoFocus
                      id="heading"
                      className="mb-4 mt-2 bg-white"
                      name="heading"
                      placeholder="Job Application Form"
                      defaultValue={verifyEmailSurveyDetails.name}
                      onChange={(e) => handleVerifyEmailSurveyDetailsChange({ name: e.target.value })}
                    />

                    <Label htmlFor="headline">Subheader (Public)</Label>
                    <Input
                      className="mt-2 bg-white"
                      id="subheading"
                      name="subheading"
                      placeholder="Thanks for applying as a full stack engineer"
                      defaultValue={verifyEmailSurveyDetails.subheading}
                      onChange={(e) => handleVerifyEmailSurveyDetailsChange({ subheading: e.target.value })}
                    />
                  </div>
                </div>
              </AdvancedOptionToggle>
              <AdvancedOptionToggle
                htmlId="protectSurveyWithPin"
                isChecked={isPinProtectionEnabled}
                onToggle={handleProtectSurveyWithPinToggle}
                title="Protect Survey with a PIN"
                description="Only users who have the PIN can access the survey."
                childBorder={true}>
                <div className="flex w-full items-center space-x-1 p-4 pb-4">
                  <div className="w-full cursor-pointer items-center  bg-slate-50">
                    <Label htmlFor="headline">Add PIN</Label>
                    <Input
                      autoFocus
                      type="number"
                      id="heading"
                      isInvalid={Boolean(verifyProtectWithPinError)}
                      className="mb-4 mt-2 bg-white"
                      name="heading"
                      placeholder="1234"
                      onBlur={handleProtectSurveyPinBlurEvent}
                      defaultValue={localSurvey.pin ? localSurvey.pin : undefined}
                      onKeyDown={handleSurveyPinInputKeyDown}
                      onChange={(e) => handleProtectSurveyPinChange(e.target.value)}
                    />
                    {verifyProtectWithPinError && (
                      <p className="text-sm text-red-700">{verifyProtectWithPinError}</p>
                    )}
                  </div>
                </div>
              </AdvancedOptionToggle>
            </>
          )}
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
