"use client";

import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { Survey } from "@/types/surveys";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import Link from "next/link";
import { useState } from "react";

interface DisplayOption {
  id: string;
  name: string;
  description: string;
}

const displayOptions: DisplayOption[] = [
  {
    id: "displayOnce",
    name: "Show once",
    description: "If person doesn't respond the survey won't be shown again.",
  },
  {
    id: "displayMultiple",
    name: "Display until responded",
    description: "If you really want that answer, ask until you get it.",
  },
  {
    id: "respondMultiple",
    name: "Always display when conditions match",
    description: "This is useful for e.g. Feedback Boxes. Can cause survey fatigue.",
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

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className=" w-full space-y-2 rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-6">
          <div className="flex items-center pr-5 pl-2">
            <CheckCircleIcon className="h-8 w-8 text-green-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-800">Recontact Options</p>
            <p className="mt-1 truncate text-sm text-slate-500">
              Decide how often people can answer this survey.
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="pb-3">
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          <RadioGroup
            value={localSurvey.displayOptions}
            className="flex flex-col space-y-3"
            onValueChange={(v) => {
              const updatedSurvey = { ...localSurvey, displayOptions: v };
              setLocalSurvey(updatedSurvey);
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
            <Checkbox id="recontactDays" checked={ignoreWaiting} onCheckedChange={handleCheckMark} />
            <Label htmlFor="recontactDays" className="cursor-pointer">
              <div className="ml-2">
                <h3 className="text-base font-semibold text-slate-700">
                  Ignore waiting time between surveys
                </h3>
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
                  key="ignore"
                  htmlFor="ignore"
                  className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4">
                  <RadioGroupItem
                    value="0"
                    id="ignore"
                    className="aria-checked:border-brand-dark  mx-5 disabled:border-slate-400 aria-checked:border-2"
                  />
                  <div className="">
                    <p className="font-semibold text-slate-700">Always show survey</p>

                    <p className="mt-2 text-xs font-normal text-slate-600">
                      When conditions match, waiting time will be ignored and survey shown.
                    </p>
                  </div>
                </Label>

                <Label
                  key="newDays"
                  htmlFor="newDays"
                  className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4">
                  <RadioGroupItem
                    value={inputDays.toString()}
                    id="newDays"
                    className="aria-checked:border-brand-dark mx-5 disabled:border-slate-400 aria-checked:border-2"
                  />
                  <div className="">
                    <p className="font-semibold text-slate-700">
                      Wait
                      <Input
                        type="number"
                        min="1"
                        id="inputDays"
                        value={inputDays}
                        onChange={handleRecontactDaysChange}
                        className="ml-2 mr-2 inline  w-16 text-center"
                      />
                      days before showing this survey again.
                    </p>

                    <p className="mt-2 text-xs font-normal text-slate-600">
                      Overwrites waiting period between surveys to {inputDays} day(s).
                    </p>
                  </div>
                </Label>
              </RadioGroup>
            </div>
          )}
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
