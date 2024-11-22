import { Checkbox } from "@/modules/ui/components/checkbox";
import { useTranslations } from "next-intl";
import React from "react";
import { TPipelineTrigger } from "@formbricks/types/pipelines";

interface TriggerCheckboxGroupProps {
  selectedTriggers: TPipelineTrigger[];
  onCheckboxChange: (selectedValue: TPipelineTrigger) => void;
  allowChanges: boolean;
}

const triggers = [
  {
    title: "environments.integrations.webhooks.response_created",
    value: "responseCreated" as TPipelineTrigger,
  },
  {
    title: "environments.integrations.webhooks.response_updated",
    value: "responseUpdated" as TPipelineTrigger,
  },
  {
    title: "environments.integrations.webhooks.response_finished",
    value: "responseFinished" as TPipelineTrigger,
  },
];

export const TriggerCheckboxGroup: React.FC<TriggerCheckboxGroupProps> = ({
  selectedTriggers,
  onCheckboxChange,
  allowChanges,
}) => {
  const t = useTranslations();
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
              <span className="ml-2">{t(trigger.title)}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};
