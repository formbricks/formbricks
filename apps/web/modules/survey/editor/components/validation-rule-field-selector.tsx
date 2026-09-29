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
}: Readonly<ValidationRuleFieldSelectorProps>) => {
  const { t } = useTranslation();

  return (
    <Select
      value={value ?? ""}
      onValueChange={(val) => onChange(val ? (val as TAddressField | TContactInfoField) : undefined)}>
      {/* w-auto for the same reason as the other row children: Address and Contact Info fields only
          ever carry string rules, so this never appears on the wrapping date row. */}
      <SelectTrigger className="h-9 w-auto min-w-0 grow bg-white">
        <SelectValue placeholder={t("workspace.surveys.edit.select_field")} />
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
