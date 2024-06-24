import React from "react";
import { TPipelineTrigger } from "@formbricks/types/pipelines";
import { Checkbox } from "@formbricks/ui/Checkbox";

interface TriggerCheckboxGroupProps {
  triggers: { title: string; value: TPipelineTrigger }[];
  selectedTriggers: TPipelineTrigger[];
  onCheckboxChange: (selectedValue: TPipelineTrigger) => void;
  allowChanges: boolean;
}

export const TriggerCheckboxGroup: React.FC<TriggerCheckboxGroupProps> = ({
  triggers,
  selectedTriggers,
  onCheckboxChange,
  allowChanges,
}) => {
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
