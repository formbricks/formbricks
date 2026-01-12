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
  onChange?: (value: string) => void;
  unitOptions: UnitOption[];
  ruleLabels: Record<string, string>;
  disabled?: boolean;
}

export const ValidationRuleUnitSelector = ({
  value,
  onChange,
  unitOptions,
  ruleLabels,
  disabled = false,
}: ValidationRuleUnitSelectorProps) => {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || unitOptions.length === 1}>
      <SelectTrigger className={cn("flex-1 bg-white", disabled && "cursor-not-allowed")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {unitOptions.map((unit) => (
          <SelectItem key={unit.value} value={unit.value}>
            {ruleLabels[unit.labelKey]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
