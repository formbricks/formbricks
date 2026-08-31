"use client";

import * as React from "react";
import { type DayButton, DayPicker, getDefaultClassNames } from "react-day-picker";
import { cn } from "@/lib/cn";
import { getDateFnsLocale } from "@/lib/utils/datetime";
import { Button, buttonVariants } from "@/modules/ui/components/button";

/**
 * `DayPicker`'s props are a union discriminated on `mode`, so a plain `Omit` flattens it and every
 * mode-specific prop (`selected`, `onSelect`) loses its type. Distributing the omit keeps each member.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type CalendarProps = DistributiveOmit<React.ComponentProps<typeof DayPicker>, "locale"> & {
  /** App locale code (e.g. "de-DE"); resolved to a date-fns locale for month and weekday names. */
  locale?: string;
};

const CalendarChevron = ({
  className,
  orientation,
}: Readonly<{ className?: string; orientation?: "left" | "right" | "up" | "down" }>) => {
  const rotation = {
    left: "rotate-90",
    right: "-rotate-90",
    up: "rotate-180",
    down: "",
  }[orientation ?? "down"];

  return (
    <svg
      className={cn("size-4", rotation, className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
};

/**
 * A day cell.
 *
 * The visual state comes from `data-*` attributes rather than from `classNames.selected` and friends,
 * because a range needs to distinguish five states (single, range start, range middle, range end, and
 * today) that `classNames` alone cannot express without fighting specificity.
 */
const CalendarDayButton = ({
  className,
  // Destructured out rather than used: react-day-picker passes its own `CalendarDay` object here, and
  // spreading it into the `Button` would put a non-DOM prop on the underlying `<button>`.
  day: _day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) => {
  const defaultClassNames = getDefaultClassNames();
  const ref = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const isSingleSelected =
    modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle;

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-selected-single={isSingleSelected ? true : undefined}
      data-range-start={modifiers.range_start ? true : undefined}
      data-range-end={modifiers.range_end ? true : undefined}
      data-range-middle={modifiers.range_middle ? true : undefined}
      className={cn(
        "flex aspect-square h-auto w-full min-w-[var(--cell-size)] flex-col gap-1 leading-none font-normal text-slate-700 hover:bg-slate-100",
        // The two range ends and a single selection share the same solid treatment; the days between
        // get the light wash so the interval reads as one block without competing with its ends.
        "data-[selected-single=true]:bg-slate-900 data-[selected-single=true]:text-white data-[selected-single=true]:hover:bg-slate-900 data-[selected-single=true]:hover:text-white",
        "data-[range-start=true]:bg-slate-900 data-[range-start=true]:text-white data-[range-start=true]:hover:bg-slate-900 data-[range-start=true]:hover:text-white",
        "data-[range-end=true]:bg-slate-900 data-[range-end=true]:text-white data-[range-end=true]:hover:bg-slate-900 data-[range-end=true]:hover:text-white",
        "data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-slate-100 data-[range-middle=true]:text-slate-900",
        "data-[range-end=true]:rounded-l-none data-[range-end=true]:rounded-r-md data-[range-start=true]:rounded-l-md data-[range-start=true]:rounded-r-none",
        "group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-1 group-data-[focused=true]/day:ring-slate-900",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  );
};

export const Calendar = ({
  className,
  classNames,
  showOutsideDays = true,
  locale,
  components,
  ...props
}: Readonly<CalendarProps>) => {
  const defaultClassNames = getDefaultClassNames();
  const resolvedLocale = React.useMemo(() => getDateFnsLocale(locale), [locale]);

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={resolvedLocale}
      captionLayout="label"
      className={cn("group/calendar p-3 [--cell-size:2.25rem]", className)}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "size-[var(--cell-size)] select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "size-[var(--cell-size)] select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-[var(--cell-size)] w-full items-center justify-center px-[var(--cell-size)]",
          defaultClassNames.month_caption
        ),
        caption_label: cn("select-none text-sm font-medium text-slate-900", defaultClassNames.caption_label),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 select-none rounded-md text-[0.8rem] font-normal text-slate-500",
          defaultClassNames.weekday
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none p-0 text-center",
          defaultClassNames.day
        ),
        range_start: cn("rounded-l-md", defaultClassNames.range_start),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("rounded-r-md", defaultClassNames.range_end),
        // A ring rather than a fill: today has to stay legible under a selection, and a filled
        // "today" was previously indistinguishable from a selected day.
        today: cn(
          "rounded-md ring-1 ring-inset ring-slate-400 data-[selected=true]:ring-0",
          defaultClassNames.today
        ),
        outside: cn("text-slate-400", defaultClassNames.outside),
        disabled: cn("text-slate-300", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: CalendarChevron,
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
};

Calendar.displayName = "Calendar";
