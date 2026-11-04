"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { InfoTooltip } from "@/modules/ui/components/info-tooltip";
import { InputCombobox, type TComboboxOption } from "@/modules/ui/components/input-combo-box";

interface CalculatedFieldPickerProps {
  readonly id: string;
  /** The survey's Calculated fields (`getActionVariableOptions`): the only fields Set value writes. */
  readonly options: TComboboxOption[];
  readonly value: string;
  readonly onChange: (variableId: string) => void;
  /** Opens the Embedded Data card to add a field; without it the empty state only explains. */
  readonly onAddCalculatedField?: () => void;
}

/**
 * The field a Set value writes. With no Calculated field in the survey it says so, and why a Passed
 * in field isn't listed, with a way to create one, instead of an empty dropdown.
 */
export function CalculatedFieldPicker({
  id,
  options,
  value,
  onChange,
  onAddCalculatedField,
}: CalculatedFieldPickerProps) {
  const { t } = useTranslation();

  if (options.length === 0) {
    return (
      <div
        id={id}
        className="flex h-10 items-center gap-2 rounded-md border border-dashed border-slate-300 bg-white px-3 text-sm whitespace-nowrap text-slate-500">
        <span>{t("workspace.surveys.edit.flow.no_calculated_fields")}</span>
        {onAddCalculatedField && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0 text-sm"
            onClick={onAddCalculatedField}>
            {t("workspace.surveys.edit.flow.create_calculated_field")}
          </Button>
        )}
        <InfoTooltip label={t("workspace.surveys.edit.flow.about_calculated_fields")}>
          {t("workspace.surveys.edit.flow.only_calculated_fields_hint")}
        </InfoTooltip>
      </div>
    );
  }

  return (
    <InputCombobox
      id={id}
      showSearch={false}
      options={options}
      value={value}
      placeholder={t("workspace.surveys.edit.flow.select_calculated_field")}
      onChangeValue={(val) => onChange(String(val))}
      comboboxClasses="grow"
    />
  );
}
