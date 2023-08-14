"use client";

import { cn } from "@formbricks/lib/cn";
import type { Survey } from "@formbricks/types/surveys";
import { Badge, Input, Label, RadioGroup, RadioGroupItem, Switch } from "@formbricks/ui";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import Link from "next/link";
import { useEffect, useState } from "react";

interface DisplayOption {
  id: "displayOnce" | "displayMultiple" | "respondMultiple";
  name: string;
  description: string;
}

const displayOptions: DisplayOption[] = [
  {
    id: "displayOnce",
    name: "Show only once",
    description: "The survey will be shown once, even if person doesn't respond.",
  },
  {
    id: "displayMultiple",
    name: "Until they submit a response",
    description: "If you really want that answer, ask until you get it.",
  },
  {
    id: "respondMultiple",
    name: "Keep showing while conditions match",
    description: "Even after they submitted a response (e.g. Feedback Box)",
  },
];

interface RecontactOptionsCardProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
  environmentId: string;
}

export default function RecontactOptionsCard({
  localSurvey,
  setLocalSurvey,
  environmentId,
}: RecontactOptionsCardProps) {
  const [open, setOpen] = useState(false);
  const ignoreWaiting = localSurvey.recontactDays !== null;
  const [inputDays, setInputDays] = useState(
    localSurvey.recontactDays !== null ? localSurvey.recontactDays : 1
  );

  const handleCheckMark = () => {
    if (ignoreWaiting) {
      const updatedSurvey = { ...localSurvey, recontactDays: null };
      setLocalSurvey(updatedSurvey);
    } else {
      const updatedSurvey = { ...localSurvey, recontactDays: 0 };
      setLocalSurvey(updatedSurvey);
    }
  };

  const handleRecontactDaysChange = (event) => {
    const value = Number(event.target.value);
    setInputDays(value);

    const updatedSurvey = { ...localSurvey, recontactDays: value };
    setLocalSurvey(updatedSurvey);
  };

  useEffect(() => {
    if (localSurvey.type === "link") {
      setOpen(false);
    }
  }, [localSurvey.type]);

  /*   if (localSurvey.type === "link") {
    return null;
  } */

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
            <p className="font-semibold text-slate-800">Recontact Options</p>
            <p className="mt-1 text-sm text-slate-500">
              Decide how often people can answer this survey.
            </p>
          </div>
          {localSurvey.type === "link" && (
            <div className="flex w-full items-center justify-end pr-2">
              <Badge size="normal" text="In-app survey settings" type="gray" />
            </div>
          )}
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="pb-3">
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          <RadioGroup
            value={localSurvey.displayOption}
            className="flex flex-col space-y-3"
            onValueChange={(v) => {
              if (v === "displayOnce" || v === "displayMultiple" || v === "respondMultiple") {
                const updatedSurvey = { ...localSurvey, displayOption: v };
                // @ts-ignore
                setLocalSurvey(updatedSurvey);
              }
            }}>
            {displayOptions.map((option) => (
              <Label
                key={option.name}
                htmlFor={option.name}
                className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4">
                <RadioGroupItem
                  value={option.id}
                  id={option.name}
                  className="aria-checked:border-brand-dark  mx-5 disabled:border-slate-400 aria-checked:border-2"
                />
                <div className="">
                  <p className="font-semibold text-slate-700">{option.name}</p>

                  <p className="mt-2 text-xs font-normal text-slate-600">{option.description}</p>
                </div>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="p-3">
          <div className="ml-2 flex items-center space-x-1">
            <Switch id="recontactDays" checked={ignoreWaiting} onCheckedChange={handleCheckMark} />
            {/* <Checkbox id="recontactDays" checked={ignoreWaiting} onCheckedChange={handleCheckMark} /> */}
            <Label htmlFor="recontactDays" className="cursor-pointer">
              <div className="ml-2">
                <h3 className="text-sm font-semibold text-slate-700">Ignore waiting time between surveys</h3>
                <p className="text-xs font-normal text-slate-500">
                  This setting overwrites your{" "}
                  <Link
                    className="decoration-brand-dark underline"
                    href={`/environments/${environmentId}/settings/product`}
                    target="_blank">
                    waiting period
                  </Link>
                  . Use with caution.
                </p>
              </div>
            </Label>
          </div>
          {ignoreWaiting && localSurvey.recontactDays !== null && (
            <div className="p-3">
              <RadioGroup
                value={localSurvey.recontactDays.toString()}
                className="flex flex-col space-y-3"
                onValueChange={(v) => {
                  const updatedSurvey = { ...localSurvey, recontactDays: v === "null" ? null : Number(v) };
                  setLocalSurvey(updatedSurvey);
                }}>
                <Label
                  htmlFor="ignore"
                  className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4">
                  <RadioGroupItem
                    value="0"
                    id="ignore"
                    className="aria-checked:border-brand-dark mx-5 text-sm disabled:border-slate-400 aria-checked:border-2"
                  />
                  <div>
                    <p className="font-semibold text-slate-700">Always show survey</p>

                    <p className="mt-2 text-xs font-normal text-slate-600">
                      When conditions match, waiting time will be ignored and survey shown.
                    </p>
                  </div>
                </Label>

                <label
                  htmlFor="newDays"
                  className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4">
                  <RadioGroupItem
                    value={inputDays === 0 ? "1" : inputDays.toString()} //Fixes that both radio buttons are checked when inputDays is 0
                    id="newDays"
                    className="aria-checked:border-brand-dark mx-5 disabled:border-slate-400 aria-checked:border-2"
                  />
                  <div className="">
                    <p className="text-sm font-semibold text-slate-700">
                      Wait
                      <Input
                        type="number"
                        min="1"
                        id="inputDays"
                        value={inputDays === 0 ? 1 : inputDays}
                        onChange={handleRecontactDaysChange}
                        className="ml-2 mr-2 inline w-16 text-center text-sm"
                      />
                      days before showing this survey again.
                    </p>

                    <p className="mt-2 text-xs font-normal text-slate-600">
                      Overwrites waiting period between surveys to {inputDays === 0 ? 1 : inputDays} day(s).
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          )}
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
