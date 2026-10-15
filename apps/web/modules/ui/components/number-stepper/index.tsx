"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { type TStepperBounds, commitStepperInput, isAtMax, isAtMin, stepValue } from "./lib/number-stepper";

interface NumberStepperProps extends TStepperBounds {
  value: number;
  onChange: (value: number) => void;
  /** Shown after the number, e.g. "px" or "%". */
  unit?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

/**
 * A number field with − and + buttons, for precise values like font size, padding, radius or a
 * percentage. ArrowUp/ArrowDown step (Shift for ×10), Enter commits, Escape reverts, blur clamps.
 */
export const NumberStepper = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  disabled,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}: Readonly<NumberStepperProps>) => {
  const { t } = useTranslation();
  const bounds = { min, max, step };
  // Typed text only exists while the user is editing; otherwise the field shows `value`, so
  // outside changes (buttons, parent updates) need no syncing.
  const [editing, setEditing] = useState<string | null>(null);
  const draft = editing ?? String(value);

  const commit = (next: number) => {
    setEditing(null);
    if (next !== value) onChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const multiplier = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      commit(stepValue(value, (event.key === "ArrowUp" ? 1 : -1) * multiplier, bounds));
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit(commitStepperInput(draft, value, bounds));
    } else if (event.key === "Escape") {
      setEditing(null);
    }
  };

  const atMin = isAtMin(value, bounds);
  const atMax = isAtMax(value, bounds);

  return (
    <div
      className={cn(
        "flex h-10 w-full items-stretch overflow-hidden rounded-md border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-slate-400 focus-within:ring-offset-2",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}>
      <Button
        type="button"
        variant="ghost"
        tabIndex={-1}
        disabled={disabled || atMin}
        aria-label={t("common.decrease")}
        onClick={() => commit(stepValue(value, -1, bounds))}
        className="h-full w-10 shrink-0 rounded-none border-r border-slate-200 bg-slate-50 px-0 text-slate-600">
        <MinusIcon />
      </Button>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-1 px-2">
        <input
          id={id}
          role="spinbutton"
          inputMode="decimal"
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          disabled={disabled}
          value={draft}
          onChange={(event) => setEditing(event.target.value)}
          onBlur={() => commit(commitStepperInput(draft, value, bounds))}
          onKeyDown={onKeyDown}
          className="w-full min-w-0 bg-transparent text-right text-sm font-medium text-slate-800 tabular-nums outline-hidden disabled:cursor-not-allowed"
          style={{ maxWidth: `${Math.max(draft.length, 1) + 1}ch` }}
        />
        {unit && <span className="text-sm text-slate-500">{unit}</span>}
      </div>
      <Button
        type="button"
        variant="ghost"
        tabIndex={-1}
        disabled={disabled || atMax}
        aria-label={t("common.increase")}
        onClick={() => commit(stepValue(value, 1, bounds))}
        className="h-full w-10 shrink-0 rounded-none border-l border-slate-200 bg-slate-50 px-0 text-slate-600">
        <PlusIcon />
      </Button>
    </div>
  );
};
