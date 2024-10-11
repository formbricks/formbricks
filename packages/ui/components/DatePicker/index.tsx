"use client";

import { format } from "date-fns";
import { addDays } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useRef } from "react";
import { SelectSingleEventHandler } from "react-day-picker";
import { cn } from "@formbricks/lib/cn";
import { Button } from "../Button";
import { Calendar } from "../Calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../Popover";

export const DatePicker = ({
  date,
  handleDateChange,
}: {
  date?: Date | null;
  handleDateChange: (date?: Date) => void;
}) => {
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
          autoFocus
          mode="single"
          selected={formattedDate}
          disabled={{
            before: addDays(new Date(), 1),
          }}
          onSelect={handleDateSelect}
        />
      </PopoverContent>
    </Popover>
  );
};
