"use client";

import { capitalize } from "lodash";
import { TValidationRuleType } from "@formbricks/types/surveys/validation-rules";
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
}

export const ValidationRuleTypeSelector = ({
  value,
  onChange,
  availableTypes,
  ruleLabels,
  needsValue,
}: ValidationRuleTypeSelectorProps) => {
  return (
    <Select value={value} onValueChange={(val) => onChange(val as TValidationRuleType)}>
      <SelectTrigger className={cn("bg-white", needsValue ? "min-w-[200px]" : "flex-1")}>
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
