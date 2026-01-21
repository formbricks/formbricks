"use client";

import { useTranslation } from "react-i18next";
import { TAddressField, TContactInfoField } from "@formbricks/types/surveys/validation-rules";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface ValidationRuleFieldSelectorProps {
  value: TAddressField | TContactInfoField | undefined;
  onChange: (value: TAddressField | TContactInfoField | undefined) => void;
  fieldOptions: { value: TAddressField | TContactInfoField; label: string }[];
}

export const ValidationRuleFieldSelector = ({
  value,
  onChange,
  fieldOptions,
}: ValidationRuleFieldSelectorProps) => {
  const { t } = useTranslation();

  return (
    <Select
      value={value ?? ""}
      onValueChange={(val) => onChange(val ? (val as TAddressField | TContactInfoField) : undefined)}>
      <SelectTrigger className="h-9 min-w-[140px] bg-white">
        <SelectValue placeholder={t("environments.surveys.edit.select_field")} />
      </SelectTrigger>
      <SelectContent>
        {fieldOptions.map((field) => (
          <SelectItem key={field.value} value={field.value}>
            {field.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
