"use client";

import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";

import { cn } from "@formbricks/lib/cn";
import { TSurvey } from "@formbricks/types/surveys";
import { UpgradePlanNotice } from "@formbricks/ui/UpgradePlanNotice";

interface UserTargetingCardProps {
  localSurvey: TSurvey;
  environmentId: string;
}

export default function UserTargetingCard({ localSurvey, environmentId }: UserTargetingCardProps) {
  const [open, setOpen] = useState(false);

  if (localSurvey.type === "link") {
    return null; // Hide card completely
  }

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        open ? "" : "hover:bg-slate-50",
        "w-full space-y-2 rounded-lg border border-slate-300 bg-white "
      )}>
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckCircleIcon className="h-8 w-8 text-green-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Target Audience</p>
            <p className="mt-1 text-sm text-slate-500">
              Pre-segment your target audience by attribute, action and device.
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          <div className="flex flex-col items-center justify-center rounded-md border border-slate-200 p-6 text-slate-700">
            Placeholder for basic editor
          </div>
          <UpgradePlanNotice
            message="For advanced user targeting,"
            url={`/environments/${environmentId}/settings/billing`}
            textForUrl="please use Pro (free to get started)."
          />
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
