"use client";

import { isValid, parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import { formatLocalDay } from "@/lib/utils/datetime";
import { DatePicker } from "@/modules/ui/components/date-picker";

interface FilterDateInputProps {
  value: string;
  onChange: (value: string | null) => void;
}

/**
 * Date-picker filter input for time-type dimensions (e.g. Collected At, Value (Date)).
 * Stores the picked day as a `yyyy-MM-dd` string (the machine value Cube expects for time
 * filters) while the shared picker renders it locale-aware.
 */
export function FilterDateInput({ value, onChange }: Readonly<FilterDateInputProps>) {
  const { i18n } = useTranslation();

  const parsed = value ? parseISO(value) : null;
  const selectedDate = parsed && isValid(parsed) ? parsed : null;

  return (
    <DatePicker
      value={selectedDate}
      locale={i18n.resolvedLanguage ?? i18n.language ?? "en-US"}
      triggerClassName="min-w-0 flex-1 basis-36"
      onChange={(date) => onChange(formatLocalDay(date))}
    />
  );
}
