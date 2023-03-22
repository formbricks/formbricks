"use client";

import { Label } from "@/components/ui/Label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { Survey } from "@/types/surveys";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import clsx from "clsx";
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
    name: "Collects a limited amount of responses",
    description: "Stops collecting responses when limit is reached.",
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
      className="w-full space-y-2 rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-6">
          <div className="flex items-center pr-5 pl-2">
            <CheckCircleIcon className="h-8 w-8 text-teal-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-800">Response Options</p>
            <p className="mt-1 truncate text-sm text-slate-500">Decide when the survey should end.</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          <RadioGroup value="ongoing" className="flex flex-col space-y-3">
            {options.map((option) => (
              <Label
                htmlFor={option.id}
                className={clsx(
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
                    <p
                      className={clsx(
                        "font-semibold",
                        option.disabled ? "text-slate-500" : "text-slate-800"
                      )}>
                      {option.name}
                    </p>
                    {option.disabled && (
                      <span className="ml-2 inline-flex items-center rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
                        coming soon
                      </span>
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
