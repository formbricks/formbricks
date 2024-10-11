"use client";

import { format } from "date-fns";
import { CalendarCheckIcon, CalendarIcon } from "lucide-react";
import { useRef, useState } from "react";
import Calendar from "react-calendar";
import { cn } from "@formbricks/lib/cn";
import { Button } from "../Button";
import { Popover, PopoverContent, PopoverTrigger } from "../Popover";
import "./styles.css";

const getOrdinalSuffix = (day: number) => {
  if (day > 3 && day < 21) return "th"; // 11th, 12th, 13th, etc.
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

export const DatePicker = ({ date }: { date?: Date | null }) => {
  const [value, onChange] = useState<Date | undefined>(date ? new Date(date) : undefined);
  const [formattedDate, setFormattedDate] = useState<string | undefined>(
    date ? format(new Date(date), "do MMM, yyyy") : undefined
  );
  const [isOpen, setIsOpen] = useState(false);

  const btnRef = useRef<HTMLButtonElement>(null);

  const handleDateChange = (date: Date) => {
    const day = date.getDate();
    const ordinalSuffix = getOrdinalSuffix(day);
    const formatted = format(date, `d'${ordinalSuffix}' MMM, yyyy`);
    setFormattedDate(formatted);
    onChange(date);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {formattedDate ? (
          <Button
            variant={"minimal"}
            className={cn(
              "w-[280px] justify-start border border-slate-300 bg-white text-left font-normal transition-all ease-in hover:bg-slate-300",
              !formattedDate && "text-muted-foreground bg-slate-800"
            )}
            ref={btnRef}>
            <CalendarCheckIcon className="mr-2 h-4 w-4" />
            {formattedDate}
          </Button>
        ) : (
          <Button
            variant={"minimal"}
            className={cn(
              "w-[280px] justify-start border border-slate-300 bg-white text-left font-normal hover:bg-slate-300",
              !formattedDate && "text-muted-foreground"
            )}
            onClick={() => setIsOpen(true)}
            ref={btnRef}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span>Pick a date</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="min-w-1/3 rounded-lg p-0">
        <Calendar
          defaultValue={undefined}
          value={value}
          onChange={(date) => handleDateChange(date as Date)}
          defaultActiveStartDate={undefined}
          minDate={new Date()}
        />
      </PopoverContent>
    </Popover>
  );
};
