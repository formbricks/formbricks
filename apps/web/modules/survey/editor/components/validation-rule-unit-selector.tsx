"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { cn } from "@/modules/ui/lib/utils";

interface UnitOption {
  value: string;
  labelKey: string;
}

interface ValidationRuleUnitSelectorProps {
  value: string;
  unitOptions: UnitOption[];
  ruleLabels: Record<string, string>;
  disabled?: boolean;
}

export const ValidationRuleUnitSelector = ({
  value,
  unitOptions,
  ruleLabels,
  disabled = false,
}: Readonly<ValidationRuleUnitSelectorProps>) => {
  // A single unit is a label, not a choice, so the trigger is inert either way.
  const isDisabled = disabled || unitOptions.length === 1;

  return (
    <Select value={value} onValueChange={() => {}} disabled={isDisabled}>
      <SelectTrigger
        className={cn(
          // 180px wide where the row has room, but it must give that width back rather than spill out
          // of the value group and cover the delete and add buttons (ENG-3175).
          "h-9 w-[180px] min-w-0 bg-white",
          // A disabled trigger still hit-tests: it swallowed every click aimed at whatever sat under
          // it without doing anything itself.
          isDisabled && "pointer-events-none"
        )}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {unitOptions.map((unit) => (
          <SelectItem key={unit.value} value={unit.value} className="truncate">
            {ruleLabels[unit.labelKey]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
