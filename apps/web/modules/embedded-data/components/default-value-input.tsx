"use client";

import { useTranslation } from "react-i18next";
import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import { formatLocalDay, parseStoredDay } from "@/lib/utils/datetime";
import { DatePicker } from "@/modules/ui/components/date-picker";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

/** Radix refuses an empty item value, so "no default" travels as a sentinel and is mapped back. */
const NO_DEFAULT_VALUE = "__no_default__";

interface DefaultValueInputProps {
  dataType: TEmbeddedDataType;
  /** Stable handle for the control. The date picker is a popover trigger and takes none. */
  id?: string;
  /** The draft value as the DOM holds it: a string, whatever the stored column is. */
  value: string;
  onChange: (value: string) => void;
  /** App locale — the date picker formats against it. */
  locale: string;
}

/**
 * The control a field's default value is typed into, by the type of value it holds.
 *
 * One component rather than one per form: the workspace library dialog and the survey editor's
 * Embedded Data card author the same column, and a boolean default offered as a free-text box in one
 * of them would be refused by `ZEmbeddedData` only after the author had typed it.
 *
 * A blank draft means "no default" — never `""`, which is a value an ingested field would then be
 * filled with. `parseDefaultValueDraft` is the other half of that, and the two are the only places
 * that know it.
 */
export const DefaultValueInput = ({
  dataType,
  id,
  value,
  onChange,
  locale,
}: Readonly<DefaultValueInputProps>) => {
  const { t } = useTranslation();

  if (dataType === "boolean") {
    return (
      <Select
        value={value === "" ? NO_DEFAULT_VALUE : value}
        onValueChange={(next) => onChange(next === NO_DEFAULT_VALUE ? "" : next)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_DEFAULT_VALUE}>{t("workspace.embedded_data.no_default")}</SelectItem>
          <SelectItem value="true">{t("workspace.embedded_data.value_true")}</SelectItem>
          <SelectItem value="false">{t("workspace.embedded_data.value_false")}</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (dataType === "date") {
    return (
      <DatePicker
        value={parseStoredDay(value)}
        locale={locale}
        triggerClassName="w-full"
        onChange={(date) => onChange(formatLocalDay(date))}
        onClear={() => onChange("")}
      />
    );
  }

  return (
    <Input
      id={id}
      type={dataType === "number" ? "number" : "text"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
};
