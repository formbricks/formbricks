"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";
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
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
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
      {/*
        A press anywhere between the buttons lands on the input: it fills the space up to the unit,
        and the unit is a label for it. That label adds only the unit to the field's name; a label
        wrapping the input would add its digits too.
      */}
      <div className="flex min-w-0 flex-1 items-stretch">
        <input
          id={inputId}
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
          // `border-0 py-0`: the forms plugin's input padding would leave no room for the digits. With a
          // unit, the digits end at the middle and the unit starts there, so the pair stays centred.
          className={cn(
            "min-w-0 flex-1 basis-0 border-0 bg-transparent py-0 pl-2 text-sm font-medium text-slate-800 tabular-nums shadow-none outline-hidden focus:ring-0 disabled:cursor-not-allowed",
            unit ? "pr-0 text-right" : "pr-2 text-center"
          )}
        />
        {unit && (
          <label
            htmlFor={inputId}
            className={cn(
              "flex flex-1 basis-0 items-center pr-2 pl-1 text-sm text-slate-500",
              disabled ? "cursor-not-allowed" : "cursor-text"
            )}>
            {unit}
          </label>
        )}
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
