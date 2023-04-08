"use client";

import { cn } from "@formbricks/lib/cn";
import { TrophyIcon } from "@heroicons/react/24/outline";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";
import { Input, Label, Switch } from "@formbricks/ui";
import type { Survey } from "@formbricks/types/surveys";

interface EditThankYouCardProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
  setActiveQuestionId: (id: string | null) => void;
  activeQuestionId: string | null;
}

export default function EditThankYouCard({
  localSurvey,
  setLocalSurvey,
  setActiveQuestionId,
  activeQuestionId,
}: EditThankYouCardProps) {
  // const [open, setOpen] = useState(false);
  let open = activeQuestionId == "thank-you-card";
  const setOpen = (e) => {
    if (e) {
      setActiveQuestionId("thank-you-card");
    } else {
      setActiveQuestionId(null);
    }
  };

  const updateSurvey = (data) => {
    setLocalSurvey({
      ...localSurvey,
      thankYouCard: {
        ...localSurvey.thankYouCard,
        ...data,
      },
    });
  };

  return (
    <div className="flex flex-row rounded-lg bg-white shadow-lg">
      <div
        className={cn(
          open ? "bg-slate-600" : "bg-slate-500",
          "flex w-10 items-center justify-center rounded-l-lg group-aria-expanded:rounded-bl-none"
        )}>
        <TrophyIcon className="h-5 w-5 text-white" />
      </div>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className="flex-1 rounded-r-lg border border-slate-200">
        <Collapsible.CollapsibleTrigger
          asChild
          className="flex cursor-pointer justify-between p-4 hover:bg-slate-50">
          <div>
            <div className="inline-flex">
              <div>
                <p className="text-sm font-semibold">Thank You Card</p>
                {!open && localSurvey?.thankYouCard?.enabled && (
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {localSurvey?.thankYouCard?.enabled && "Enabled"}
                  </p>
                )}
              </div>
            </div>
            {open && (
              <div className="flex items-center space-x-2">
                <Label htmlFor="airplane-mode">Enable</Label>
                <Switch
                  id="airplane-mode"
                  //   value={localSurvey?.thankYouCard?.enabled}
                  checked={localSurvey?.thankYouCard?.enabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateSurvey({ enabled: !localSurvey.thankYouCard.enabled });
                  }}
                />
              </div>
            )}
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="px-4 pb-4">
          <form>
            <div className="mt-3">
              <Label htmlFor="headline">Headline</Label>
              <div className="mt-2">
                <Input
                  id="headline"
                  name="headline"
                  defaultValue={localSurvey?.thankYouCard?.headline}
                  onChange={(e) => {
                    updateSurvey({ headline: e.target.value });
                  }}
                />
              </div>
            </div>

            <div className="mt-3">
              <Label htmlFor="subheader">Subheader</Label>
              <div className="mt-2">
                <Input
                  id="subheader"
                  name="subheader"
                  defaultValue={localSurvey?.thankYouCard?.subheader}
                  onChange={(e) => {
                    updateSurvey({ subheader: e.target.value });
                  }}
                />
              </div>
            </div>
          </form>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
}
