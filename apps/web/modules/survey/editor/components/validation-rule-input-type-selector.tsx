"use client";

import { TSurveyOpenTextElementInputType } from "@formbricks/types/surveys/elements";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { cn } from "@/modules/ui/lib/utils";

// Reusable input type options for OpenText elements
const INPUT_TYPE_OPTIONS = (
  <>
    <SelectItem value="text">{"Text"}</SelectItem>
    <SelectItem value="email">{"Email"}</SelectItem>
    <SelectItem value="url">{"Url"}</SelectItem>
    <SelectItem value="phone">{"Phone"}</SelectItem>
    <SelectItem value="number">{"Number"}</SelectItem>
  </>
);

interface ValidationRuleInputTypeSelectorProps {
  value: TSurveyOpenTextElementInputType;
  onChange?: (value: TSurveyOpenTextElementInputType) => void;
  disabled?: boolean;
}

export const ValidationRuleInputTypeSelector = ({
  value,
  onChange,
  disabled = false,
}: ValidationRuleInputTypeSelectorProps) => {
  return (
    <Select
      value={value}
      onValueChange={onChange ? (val) => onChange(val as TSurveyOpenTextElementInputType) : undefined}
      disabled={disabled}>
      <SelectTrigger
        className={cn("h-9 min-w-[120px]", disabled ? "cursor-not-allowed bg-slate-100" : "bg-white")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{INPUT_TYPE_OPTIONS}</SelectContent>
    </Select>
  );
};
