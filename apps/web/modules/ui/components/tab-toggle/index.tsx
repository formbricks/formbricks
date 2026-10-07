import React, { useState } from "react";
import { cn } from "@/lib/cn";

interface Option<T> {
  value: T;
  label: string;
}

interface TabToggleProps<T> {
  id: string;
  options: Option<T>[];
  defaultSelected?: T;
  /** Makes the toggle controlled, for a selection that can also change elsewhere on the page. */
  value?: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export const TabToggle = <T extends string | number>({
  id,
  options,
  defaultSelected,
  value,
  onChange,
  disabled,
}: TabToggleProps<T>) => {
  const [uncontrolledOption, setSelectedOption] = useState<T | undefined>(defaultSelected);
  const selectedOption = value ?? uncontrolledOption;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value as T;
    setSelectedOption(value);
    onChange(value);
  };

  return (
    <div role="radiogroup" aria-labelledby={`${id}-toggle-label`} className="flex flex-col">
      <div className="mt-1 flex overflow-hidden rounded-md bg-slate-100 p-1">
        {options.map((option) => (
          <label
            key={option.value}
            // Scoped by the toggle's id: two toggles with an option of the same value on one page
            // (the appearance and overlay toggles both have "light"/"dark") must not share ids.
            htmlFor={`${id}-${option.value.toString()}`}
            className={cn(
              "flex-1 cursor-pointer rounded-md py-2 text-center text-sm text-slate-800",
              selectedOption === option.value && "bg-white",
              "focus:ring-2 focus:ring-brand-dark/50 focus:outline-hidden",
              disabled && "cursor-not-allowed opacity-50"
            )}>
            <input
              type="radio"
              name={id}
              disabled={disabled}
              id={`${id}-${option.value.toString()}`}
              value={option.value.toString()}
              checked={selectedOption === option.value}
              onChange={handleChange}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
};
