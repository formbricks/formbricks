"use client";

import { Checkbox } from "@/modules/ui/components/checkbox";
import { PipelineTriggers } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import React from "react";

interface TriggerCheckboxGroupProps {
  selectedTriggers: PipelineTriggers[];
  onCheckboxChange: (selectedValue: PipelineTriggers) => void;
  allowChanges: boolean;
}

export const TriggerCheckboxGroup: React.FC<TriggerCheckboxGroupProps> = ({
  selectedTriggers,
  onCheckboxChange,
  allowChanges,
}) => {
  const { t } = useTranslate();

  const triggers: {
    title: string;
    value: PipelineTriggers;
  }[] = [
    {
      title: t("environments.integrations.webhooks.response_created"),
      value: "responseCreated",
    },
    {
      title: t("environments.integrations.webhooks.response_updated"),
      value: "responseUpdated",
    },
    {
      title: t("environments.integrations.webhooks.response_finished"),
      value: "responseFinished",
    },
  ];
  return (
    <div className="mt-1 rounded-lg border border-slate-200">
      <div className="grid content-center rounded-lg bg-slate-50 p-3 text-left text-sm text-slate-900">
        {triggers.map((trigger) => (
          <div key={trigger.value} className="my-1 flex items-center space-x-2">
            <label
              htmlFor={trigger.value}
              className={`flex ${
                !allowChanges ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              } items-center`}>
              <Checkbox
                type="button"
                id={trigger.value}
                value={trigger.value}
                className="bg-white"
                checked={selectedTriggers.includes(trigger.value)}
                onCheckedChange={() => {
                  if (allowChanges) {
                    onCheckboxChange(trigger.value);
                  }
                }}
                disabled={!allowChanges}
              />
              <span className="ml-2">{trigger.title}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};
