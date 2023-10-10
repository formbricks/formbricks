"use client";

import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@formbricks/lib/cn";
import { Popover, PopoverContent, PopoverTrigger } from "../Popover";
import Button from "../Button";
import { Calendar } from "../Calendar";
import { useRef } from "react";
import { SelectSingleEventHandler } from "react-day-picker";
import { addDays } from "date-fns";

export function DatePicker({
  date,
  handleDateChange,
}: {
  date?: Date;
  handleDateChange: (date?: Date) => void;
}) {
  let formattedDate = date ? new Date(date) : undefined;

  const btnRef = useRef<HTMLButtonElement>(null);

  const handleDateSelect: SelectSingleEventHandler = (date) => {
    btnRef?.current?.click();
    handleDateChange(date);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"minimal"}
          className={cn(
            "w-[280px] justify-start border border-slate-300 bg-white text-left font-normal",
            !formattedDate && "text-muted-foreground"
          )}
          ref={btnRef}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formattedDate ? format(formattedDate, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={formattedDate}
          disabled={{
            before: addDays(new Date(), 1),
          }}
          onSelect={handleDateSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
