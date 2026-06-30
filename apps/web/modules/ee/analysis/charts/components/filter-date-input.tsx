"use client";

import { format, isValid, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import Calendar from "react-calendar";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import "@/modules/ui/components/date-picker/styles.css";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";

interface FilterDateInputProps {
  value: string;
  onChange: (value: string | null) => void;
}

/**
 * Date-picker filter input for time-type dimensions (e.g. Collected At, Value (Date)).
 * Stores the picked day as a `yyyy-MM-dd` string, the format Cube expects for time filters.
 */
export function FilterDateInput({ value, onChange }: Readonly<FilterDateInputProps>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const parsed = value ? parseISO(value) : null;
  const selectedDate = parsed && isValid(parsed) ? parsed : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-[200px] justify-start bg-white text-left font-normal">
          <CalendarIcon className="mr-2 size-4 shrink-0" />
          <span className={selectedDate ? "truncate" : "truncate text-slate-500"}>
            {selectedDate ? format(selectedDate, "MMM dd, yyyy") : t("common.pick_a_date")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          value={selectedDate}
          onChange={(next) => {
            const date = next instanceof Date ? next : null;
            if (date) {
              onChange(format(date, "yyyy-MM-dd"));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
