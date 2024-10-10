"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useRef, useState } from "react";
import Calendar from "react-calendar";
import { cn } from "@formbricks/lib/cn";
import { Button } from "../Button";
import { Popover, PopoverContent, PopoverTrigger } from "../Popover";
import "./styles.css";

export const DatePicker = ({ date }: { date?: Date | null }) => {
  const [value, onChange] = useState<Date | undefined>(date ? new Date(date) : undefined);

  var formattedDate = date ? new Date(date) : undefined;

  const btnRef = useRef<HTMLButtonElement>(null);

  const handleDateChange = (date: Date) => {
    onChange(date);
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
      <PopoverContent className="min-w-1/3 rounded-lg p-0">
        <Calendar
          defaultValue={undefined}
          value={value}
          onChange={(date) => handleDateChange(date as Date)}
          defaultActiveStartDate={undefined}
        />
      </PopoverContent>
    </Popover>
  );
};
