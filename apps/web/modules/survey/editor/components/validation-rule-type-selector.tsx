"use client";

import { TValidationRuleType } from "@formbricks/types/surveys/validation-rules";
import { capitalize } from "@/lib/utils/object";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { cn } from "@/modules/ui/lib/utils";
import { RULE_TYPE_CONFIG } from "../lib/validation-rules-config";

interface ValidationRuleTypeSelectorProps {
  value: TValidationRuleType;
  onChange: (value: TValidationRuleType) => void;
  availableTypes: TValidationRuleType[];
  ruleLabels: Record<string, string>;
  needsValue: boolean;
  className?: string;
}

export const ValidationRuleTypeSelector = ({
  value,
  onChange,
  availableTypes,
  ruleLabels,
  needsValue,
  className,
}: Readonly<ValidationRuleTypeSelectorProps>) => {
  return (
    <Select value={value} onValueChange={(val) => onChange(val as TValidationRuleType)}>
      {/* min-w-0 rather than a pixel floor: a floor here is what pushed the value group out of the
          row and under the delete and add buttons at laptop widths (ENG-3175). */}
      <SelectTrigger className={cn("bg-white", needsValue ? "min-w-0" : "flex-1", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {availableTypes.map((type) => (
          <SelectItem key={type} value={type}>
            {capitalize(ruleLabels[RULE_TYPE_CONFIG[type].labelKey])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
