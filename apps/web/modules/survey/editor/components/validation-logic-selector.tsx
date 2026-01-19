"use client";

import { useTranslation } from "react-i18next";
import type { TValidationLogic } from "@formbricks/types/surveys/elements";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface ValidationLogicSelectorProps {
  value: TValidationLogic;
  onChange: (value: TValidationLogic) => void;
}

export const ValidationLogicSelector = ({ value, onChange }: ValidationLogicSelectorProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex w-full items-center gap-2">
      <Select value={value} onValueChange={(val) => onChange(val as TValidationLogic)}>
        <SelectTrigger className="h-8 w-fit bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="and">{t("environments.surveys.edit.validation_logic_and")}</SelectItem>
          <SelectItem value="or">{t("environments.surveys.edit.validation_logic_or")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
