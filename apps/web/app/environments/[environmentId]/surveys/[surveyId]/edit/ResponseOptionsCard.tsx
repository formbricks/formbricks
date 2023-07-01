"use client";

import type { Survey } from "@formbricks/types/surveys";
import { Input, Label, Switch } from "@formbricks/ui";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useEffect, useState } from "react";

interface ResponseOptionsCardProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
}

export default function ResponseOptionsCard({ localSurvey, setLocalSurvey }: ResponseOptionsCardProps) {
  const [open, setOpen] = useState(false);
  const autoComplete = localSurvey.autoComplete !== null;
  const [redirectToggle, setRedirectToggle] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>("");

  const handleRedirectCheckMark = () => {
    if (redirectToggle && localSurvey.redirectUrl) {
      setRedirectToggle(false);
      setRedirectUrl(null);
      setLocalSurvey({ ...localSurvey, redirectUrl: null });
      return;
    }
    if (redirectToggle) {
      setRedirectToggle(false);
      return;
    }
    setRedirectToggle(true);
  };

  const handleRedirectUrlChange = (link: string) => {
    setRedirectUrl(link);
    setLocalSurvey({ ...localSurvey, redirectUrl: link });
  };

  useEffect(() => {
    if (localSurvey.redirectUrl) {
      setRedirectUrl(localSurvey.redirectUrl);
      setRedirectToggle(true);
    }
  }, []);
  const handleCheckMark = () => {
    if (autoComplete) {
      const updatedSurvey: Survey = { ...localSurvey, autoComplete: null };
      setLocalSurvey(updatedSurvey);
    } else {
      const updatedSurvey: Survey = { ...localSurvey, autoComplete: 25 };
      setLocalSurvey(updatedSurvey);
    }
  };

  const handleInputResponse = (e: any) => {
    let value = parseInt(e.target.value);
    if (value < 1) value = 1;
    const updatedSurvey: Survey = { ...localSurvey, autoComplete: value };
    setLocalSurvey(updatedSurvey);
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
            <p className="mt-1 truncate text-sm text-slate-500">
              Decide how and how long people can respond.
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          <div className="ml-2 flex items-center space-x-1 p-4">
            <Switch id="autoComplete" checked={autoComplete} onCheckedChange={handleCheckMark} />
            <Label htmlFor="autoComplete" className="cursor-pointer">
              <div className="ml-2">
                <h3 className="text-sm font-semibold text-slate-700">
                  Auto complete survey on response limit
                </h3>
              </div>
            </Label>
          </div>
          {autoComplete && (
            <div className="ml-2 flex items-center space-x-1 px-4 pb-4">
              <label
                htmlFor="autoCompleteResponses"
                className="flex w-full cursor-pointer items-center rounded-lg  border bg-slate-50 p-4">
                <div className="">
                  <p className="text-sm font-semibold text-slate-700">
                    Automatically mark the survey as complete after
                    <Input
                      type="number"
                      min="1"
                      id="autoCompleteResponses"
                      value={localSurvey.autoComplete?.toString()}
                      onChange={(e) => handleInputResponse(e)}
                      className="ml-2 mr-2 inline w-16 text-center text-sm"
                    />
                    completed responses.
                  </p>
                </div>
              </label>
            </div>
          )}
          {localSurvey.type === "link" && (
            <div className="p-3 ">
              <div className="ml-2 flex items-center space-x-1">
                <Switch id="redirectUrl" checked={redirectToggle} onCheckedChange={handleRedirectCheckMark} />
                <Label htmlFor="redirectUrl" className="cursor-pointer">
                  <div className="ml-2">
                    <h3 className="text-sm font-semibold text-slate-700">Redirect on completion</h3>
                    <p className="text-xs font-normal text-slate-500">
                      Redirect user to specified link on survey completion
                    </p>
                  </div>
                </Label>
              </div>
              <div className="mt-4">
                {redirectToggle && (
                  <Input
                    type="url"
                    placeholder="https://www.example.com"
                    value={redirectUrl ? redirectUrl : ""}
                    onChange={(e) => handleRedirectUrlChange(e.target.value)}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
