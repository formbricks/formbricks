"use client";

import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@formbricks/ui/Button";

export default function EnableUserTargetingCard() {
  const router = useRouter();
  const params = useParams();

  const [open, setOpen] = useState(false);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="w-full rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger
        asChild
        className="h-full w-full cursor-pointer rounded-lg hover:bg-slate-50">
        <div className="inline-flex px-4 py-6">
          <div className="flex items-center pl-2 pr-5">
            <CheckCircleIcon className="h-8 w-8 text-green-400 " />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Target Audience</p>
            <p className="mt-1 text-sm text-slate-500">
              Pre-segment your users with attribute, action and device filters.
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="min-w-full overflow-auto">
        <hr className="py-1 text-slate-600" />

        <div className="flex flex-col gap-2 p-6">
          <h3 className="text-xl font-medium leading-6 text-gray-900">Unlock Advanced User Targeting</h3>
          <p className="mt-2 text-sm">
            Take your user engagement to the next level with advanced targeting features. Utilize attributes,
            actions, and devices to tailor your surveys with precision.
          </p>
          <p className="mt-2 text-sm">
            These features are exclusive to our paid plans, providing you with more control and insights to
            drive your strategy forward.
          </p>
          <div className="mt-4">
            <Button
              variant="darkCTA"
              onClick={() => router.push(`/environments/${params?.environmentId}/settings/billing`)}>
              Enable User Targeting
            </Button>
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
