"use client";

import { Checkbox } from "@/components/ui/Checkbox";
import { Label } from "@/components/ui/Label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { Survey } from "@/types/surveys";
import * as Collapsible from "@radix-ui/react-collapsible";
import Link from "next/link";
import { useState } from "react";

const displayOptions = [
  {
    id: "displayOnce",
    name: "If person sees survey and does not respond, do not show again.",
    description: "Most common option. Keeps survey fatigue at minimum.",
  },
  {
    id: "displayMultiple",
    name: "If person sees survey and does not respond, show again.",
    description: "If you really want that answer, ask several times.",
  },
  {
    id: "respondMultiple",
    name: "If person has responded, show again when conditions match.",
    description: "This is useful for e.g. Feedback Boxes or Cancel Subscription Flows.",
  },
];

const waitingPeriod = [
  {
    id: 0,
    name: "Ignore waiting period, always show this survey.",
    description: "This survey will be shown even if the waiting period is not over yet.",
  },
  {
    id: 1,
    name: "Wait ___ days before showing this survey again.",
    description: "Overwrites waiting period between surveys to ___ days.",
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

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="w-full space-y-2 rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-6">
          <div className="flex items-center pr-5 pl-2">
            {/*   {!displayType ? (
              <div className="h-7 w-7 rounded-full border border-slate-400" />
            ) : (
              <CheckCircleIcon className="h-8 w-8 text-teal-400" />
            )} */}
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-800">Recontact Options</p>
            <p className="mt-1 truncate text-sm text-slate-500">
              Decide how often people can answer this survey.
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
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
          <div className="mb-4 ml-2">
            <h3 className="font-semibold text-slate-700">Ignore waiting time between surveys</h3>
            <p className="text-xs text-slate-500">
              This setting overwrites your{" "}
              <Link
                className="decoration-brand-dark underline"
                href={`/environments/${environmentId}/settings/product`}
                target="_blank">
                waiting period
              </Link>
              . This can cause survey fatigue.
            </p>
          </div>
          <div className="ml-2 flex items-center space-x-1">
            <Checkbox id="recontactDays" />
            <Label htmlFor="recontactDays">Ignore waiting time.</Label>
          </div>
          {/* <RadioGroup
            value={localSurvey.recontactDays}
            className="flex flex-col space-y-3"
            onValueChange={(v) => {
              const updatedSurvey = { ...localSurvey };
              updatedSurvey.recontactDays = v;
              setLocalSurvey(updatedSurvey);
            }}>
            {waitingPeriod.map((option) => (
              <Label
                htmlFor={option.id}
                className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4">
                <RadioGroupItem
                  value={option.id}
                  id={option.id}
                  className="aria-checked:border-brand-dark  mx-5 disabled:border-slate-400 aria-checked:border-2"
                />
                <div className="">
                  <p className="font-semibold text-slate-700">{option.name}</p>

                  <p className="mt-2 text-xs font-normal text-slate-600">{option.description}</p>
                </div>
              </Label>
            ))}
          </RadioGroup> */}
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
