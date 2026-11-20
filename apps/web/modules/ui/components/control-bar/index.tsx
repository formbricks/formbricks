"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import { Checkbox } from "@/modules/ui/components/checkbox";

export interface TControlBarItem {
  /** Stable key for the control, unique within the bar. */
  value: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

interface ControlBarProps {
  items: TControlBarItem[];
  /** Id of the element naming the whole bar, when there is one. */
  "aria-labelledby"?: string;
  className?: string;
}

interface ControlBarCellProps {
  item: TControlBarItem;
}

function ControlBarCell({ item }: Readonly<ControlBarCellProps>) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-1 px-3 py-1",
        item.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-slate-50"
      )}>
      <Checkbox
        id={id}
        checked={item.checked}
        disabled={item.disabled}
        onCheckedChange={(checked) => item.onCheckedChange(checked === true)}
        className="size-3.5 rounded-sm [&_svg]:size-3"
      />
      <span className="text-xs whitespace-nowrap text-slate-600">{item.label}</span>
    </label>
  );
}

/**
 * A row of on/off settings in one bordered bar, each a small checkbox with its label underneath.
 * It sits beside an `OptionsSwitch` with the same border and height, so a strip of settings reads as
 * one set of controls instead of switches floating between them. Takes one to n items.
 */
export const ControlBar = ({
  items,
  "aria-labelledby": ariaLabelledBy,
  className,
}: Readonly<ControlBarProps>) => {
  if (items.length === 0) return null;
  return (
    // A fieldset for the same reason as OptionsSwitch: it groups the controls natively; `min-w-0`
    // undoes the browser's `min-width: min-content` so it can shrink in a flex row.
    <fieldset
      aria-labelledby={ariaLabelledBy}
      className={cn(
        "flex min-h-[42px] min-w-0 items-stretch divide-x divide-slate-200 overflow-hidden rounded-md border bg-white",
        className
      )}>
      {items.map((item) => (
        <ControlBarCell key={item.value} item={item} />
      ))}
    </fieldset>
  );
};
