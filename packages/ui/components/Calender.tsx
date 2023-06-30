import * as React from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@formbricks/lib/cn";
import "./Calender.css";

type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calender({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
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
          "h-7 w-7 inline-flex items-center justify-center text-slate-600 hover:text-slate-500 bg-slate-200 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 focus:outline-none rounded-lg border border-slate-3 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "text-center text-sm p-0 relative cell-rounded focus-within:relative focus-within:z-20",
        day: cn(
          "inline-flex items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background hover:bg-slate-100 h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_outside: "opacity-50",
        day_disabled: "opacity-50",
        day_range_middle: "aria-selected:bg-slate-100  aria-selected:rounded-none",
        day_hidden: "invisible",
        day_range_start: "text-white hover:text-white bg-black aria-selected:hover:bg-black",
        day_range_end: "text-white hover:text-white bg-black aria-selected:hover:bg-black",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}

Calender.displayName = "Calender";

export { Calender };
