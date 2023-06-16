"use client";

import { cn } from "@formbricks/lib/cn";
import type { Survey } from "@formbricks/types/surveys";
import { Badge, Input, Label, Switch } from "@formbricks/ui";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState, useEffect } from "react";

interface ResponseOptionsCardProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
}

export default function ResponseOptionsCard({ localSurvey, setLocalSurvey }: ResponseOptionsCardProps) {
  const [open, setOpen] = useState(false);
  const autoComplete = localSurvey.autoComplete !== null;
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

  useEffect(() => {
    if (localSurvey.type === "link") {
      setOpen(false);
    }
  }, [localSurvey.type]);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(openState) => {
        if (localSurvey.type !== "link") {
          setOpen(openState);
        }
      }}
      className="w-full rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger
        asChild
        className={cn(
          localSurvey.type !== "link" ? "cursor-pointer hover:bg-slate-50" : "cursor-not-allowed bg-slate-50",
          "h-full w-full rounded-lg "
        )}>
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckCircleIcon
              className={cn(localSurvey.type !== "link" ? "text-green-400" : "text-slate-300", "h-8 w-8 ")}
            />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Response Options</p>
            <p className="mt-1 truncate text-sm text-slate-500">
              Decide how and how long people can respond.
            </p>
          </div>
          {localSurvey.type === "link" && (
            <div className="flex w-full items-center justify-end pr-2">
              <Badge size="normal" text="In-app survey settings" type="warning" />
            </div>
          )}
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          <div className="ml-2 flex items-center space-x-1 p-4">
            <Switch id="autoComplete" checked={autoComplete} onCheckedChange={handleCheckMark} />
            <Label htmlFor="autoComplete" className="cursor-pointer">
              <div className="ml-2">
                <h3 className="text-sm font-semibold text-slate-700">Auto complete survey</h3>
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
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
