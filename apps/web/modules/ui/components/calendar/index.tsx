"use client";

import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { Chevron, DayPicker } from "react-day-picker";

// import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export const Calendar = ({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) => {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "hover:text-slate-700 hover:bg-slate-200 flex justify-center items-center rounded-md transition-colors duration-150 ease-in-out h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-slate-500 rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-slate-200 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          "hover:bg-slate-200 rounded-md p-0",
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 text-center"
        ),
        day_selected: "bg-black text-white aria-selected:bg-black aria-selected:text-white",
        day_today: "bg-slate-200 aria-selected:bg-black aria-selected:text-white",
        day_outside: "text-slate-500 opacity-50",
        day_disabled: "text-slate-500 opacity-50 cursor-not-allowed",
        day_range_middle: "aria-selected:bg-slate-200",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: (props) => {
          if (props.orientation === "left") {
            return <ChevronLeft className="h-4 w-4" />;
          } else if (props.orientation === "right") {
            return <ChevronRight className="h-4 w-4" />;
          }
          return <Chevron {...props} />;
        },
      }}
      {...props}
    />
  );
};
Calendar.displayName = "Calendar";
