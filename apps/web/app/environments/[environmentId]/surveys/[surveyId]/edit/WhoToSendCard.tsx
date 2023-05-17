"use client";

import { cn } from "@formbricks/lib/cn";
import type { Survey } from "@formbricks/types/surveys";
import { Badge, Label, RadioGroup, RadioGroupItem } from "@formbricks/ui";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useEffect, useState } from "react";

const options = [
  {
    id: "all",
    name: "Everyone",
    description: "Show your survey to all users.",
    disabled: false,
  },
  {
    id: "filter",
    name: "Filter by attributes",
    description: "Target specific audiences by attributes.",
    disabled: true,
  },
];

interface WhoToSendToCardProps {
  localSurvey: Survey;
}

export default function WhoToSendToCard({ localSurvey }: WhoToSendToCardProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localSurvey.type === "link") {
      setOpen(false);
    }
  }, [localSurvey.type]);

  /*  if (localSurvey.type === "link") {
    return null;
  }
 */
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
            <p className="font-semibold text-slate-800">Target Audience</p>
            <p className="mt-1 truncate text-sm text-slate-500">Filter your users based on attributes.</p>
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
          <RadioGroup value="all" className="flex flex-col space-y-3">
            {options.map((option) => (
              <Label
                key={option.id}
                htmlFor={option.id}
                className={cn(
                  "flex w-full  items-center rounded-lg border bg-slate-50 p-4",
                  option.disabled
                    ? "border-slate-200 bg-slate-50/50"
                    : "border-brand-dark cursor-pointer bg-slate-50"
                )}>
                <RadioGroupItem
                  value={option.id}
                  id={option.id}
                  disabled={option.disabled}
                  className="aria-checked:border-brand-dark  mx-5 disabled:cursor-not-allowed disabled:border-slate-400 aria-checked:border-2"
                />
                <div>
                  <div className="inline-flex items-center">
                    <p className={cn("font-semibold", option.disabled ? "text-slate-500" : "text-slate-800")}>
                      {option.name}
                    </p>
                    {option.disabled && <Badge text="coming soon" size="normal" type="warning" />}
                  </div>
                  <p className="mt-2 text-xs font-normal text-slate-600">{option.description}</p>
                </div>
              </Label>
            ))}
          </RadioGroup>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
