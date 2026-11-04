"use client";

import { useTranslation } from "react-i18next";
import { formatLocalDay, parseStoredDay } from "@/lib/utils/datetime";
import { DatePicker } from "@/modules/ui/components/date-picker";
import { Input } from "@/modules/ui/components/input";
import { getRuleValueControl } from "../lib/rule-value-control";
import type { TFilterProperty, TRuleOperator } from "../lib/types";
import { FilterValuePicker } from "./filter-value-picker";

/**
 * The value slot of one Advanced filter rule, drawn for its property and operator: a pick-list where the
 * property has values to pick from, a date picker for a date, a number box for a number and a text box
 * for the rest. `undefined` leaves the slot to the editor's own combobox (a list operator's multi-pick,
 * typed text with seen values as suggestions); `null` means the operator compares against nothing.
 */
export const RuleValueInput = ({
  id,
  property,
  operator,
  value,
  onChange,
  invalid,
}: Readonly<{
  id: string;
  property: TFilterProperty | undefined;
  operator: TRuleOperator | "";
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
}>) => {
  const { t, i18n } = useTranslation();
  const control = getRuleValueControl(property, operator);

  switch (control) {
    case "none":
      return null;
    case "placeholder":
      return (
        <Input
          id={id}
          disabled
          readOnly
          value=""
          placeholder={t("common.table_toolbar.value")}
          aria-label={t("common.table_toolbar.value")}
          className="bg-white"
        />
      );
    case "picker":
      return property ? (
        <FilterValuePicker id={id} property={property} value={value} onChange={onChange} invalid={invalid} />
      ) : null;
    case "date":
      return (
        <DatePicker
          id={id}
          value={parseStoredDay(value)}
          locale={i18n.resolvedLanguage ?? i18n.language ?? "en-US"}
          className="w-full min-w-0"
          triggerClassName="h-10 w-full border-slate-300 px-3"
          onChange={(date) => onChange(formatLocalDay(date))}
        />
      );
    case "number":
    case "text":
      return (
        <Input
          id={id}
          type={control === "number" ? "number" : "text"}
          inputMode={control === "number" ? "decimal" : undefined}
          value={value}
          placeholder={t("common.table_toolbar.enter_value")}
          aria-label={t("common.table_toolbar.value_of", { property: property?.label ?? "" })}
          isInvalid={invalid}
          onChange={(event) => onChange(event.target.value)}
          className="bg-white"
        />
      );
    default:
      return undefined;
  }
};
