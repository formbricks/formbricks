import type { TFunction } from "i18next";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { getTranslatedDatePresetLabel } from "@/modules/ee/analysis/lib/schema-definition";
import { parseCalendarDay } from "./date-filter";
import { MULTI_VALUE_OPERATORS, getOperatorLabel, operatorTakesValue } from "./operators";
import type { TFilterProperty, TTableFilter } from "./types";
import { datePresetFromSlug } from "./url-codec";

const DAY_FORMAT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

export type TChipParts = {
  /** The property, followed by the operator for a rule: `Status:`, `Responses >`. */
  label: string;
  /** The value pill; empty for `isSet` / `isNotSet`. */
  value: string;
  /** What a screen reader hears: "Filter Status: Draft, In progress". */
  accessibleName: string;
};

const formatValue = (property: TFilterProperty, value: string, locale: string): string => {
  if (property.valueType === "date") return formatDateForDisplay(parseCalendarDay(value), locale, DAY_FORMAT);
  return property.options?.find((option) => option.value === value)?.label ?? value;
};

/** How a filter chip reads. Quick filters read `Property: values`; rules read `Property operator value`. */
export const getChipParts = (
  filter: TTableFilter,
  property: TFilterProperty,
  t: TFunction,
  locale: string
): TChipParts => {
  let label: string;
  let value: string;

  switch (filter.operator) {
    case "in":
      label = `${property.label}:`;
      value = filter.values.map((v) => formatValue(property, v, locale)).join(", ");
      break;
    case "preset": {
      const preset = datePresetFromSlug(filter.values[0]);
      label = `${property.label}:`;
      value = preset ? getTranslatedDatePresetLabel(preset, t) : filter.values[0];
      break;
    }
    case "between":
      label = `${property.label}:`;
      value = `${formatValue(property, filter.values[0], locale)} – ${formatValue(property, filter.values[1], locale)}`;
      break;
    default:
      label = `${property.label} ${getOperatorLabel(filter.operator, t)}`;
      if (MULTI_VALUE_OPERATORS.includes(filter.operator)) {
        value = filter.values.map((v) => formatValue(property, v, locale)).join(", ");
      } else if (operatorTakesValue(filter.operator)) {
        value = formatValue(property, filter.values[0] ?? "", locale);
      } else {
        value = "";
      }
  }

  const accessibleName = t("common.table_toolbar.chip_accessible_name", {
    filter: value ? `${label} ${value}` : label,
  });
  return { label, value, accessibleName };
};
