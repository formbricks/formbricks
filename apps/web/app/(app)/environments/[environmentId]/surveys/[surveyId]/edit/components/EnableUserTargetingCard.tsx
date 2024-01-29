import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";

import { Button } from "@formbricks/ui/Button";

export default function EnableUserTargetingCard() {
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
          <p className="text-base">
            User targeting is only available on paid plans. You can upgrade your plan to enable user
            targeting.
          </p>
          <Button variant="darkCTA" size="sm" className="w-fit">
            <span className="text-sm font-medium text-white">Enable User Targeting</span>
          </Button>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
