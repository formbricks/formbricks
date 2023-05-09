"use client";

import { Label } from "@formbricks/ui/Label";
import { RadioGroup, RadioGroupItem } from "@formbricks/ui/RadioGroup";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { Badge } from "@formbricks/ui/Badge";
import { cn } from "@formbricks/lib/cn";
import { useState } from "react";

const options = [
  {
    id: "ongoing",
    name: "Ongoing",
    description: "Collects responses until survey is stopped manually.",
    disabled: false,
  },
  {
    id: "limit",
    name: "Limit responses",
    description: "Stops collecting responses when number of responses is reached.",
    disabled: true,
  },
];

interface ResponseOptionsCardProps {}

export default function ResponseOptionsCard({}: ResponseOptionsCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        open ? "" : "hover:bg-slate-50",
        "w-full space-y-2 rounded-lg border border-slate-300 bg-white "
      )}>
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-6">
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
          <div className="mb-4 ml-2">
            <h3 className="font-semibold text-slate-700">Survey end</h3>
            <p className="text-xs text-slate-500">How long can the survey collect responses?</p>
          </div>
          <RadioGroup value="ongoing" className="flex flex-col space-y-3">
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
                    {option.disabled && (
                      <Badge text="coming soon" size="normal" type="warning" className="ml-2" />
                    )}
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
