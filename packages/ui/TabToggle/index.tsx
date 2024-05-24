import React, { useState } from "react";

import { cn } from "@formbricks/lib/cn";

import { Label } from "../Label";

interface Option<T> {
  value: T;
  label: string;
}

interface TabToggleProps<T> {
  id: string;
  options: Option<T>[];
  defaultSelected?: T;
  onChange: (value: T) => void;
  label: string;
  subLabel?: string;
}

export const TabToggle = <T extends string | number>({
  id,
  options,
  defaultSelected,
  onChange,
  label,
  subLabel,
}: TabToggleProps<T>) => {
  const [selectedOption, setSelectedOption] = useState<T | undefined>(defaultSelected);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value as T;
    setSelectedOption(value);
    onChange(value);
  };

  return (
    <div role="radiogroup" aria-labelledby={`${id}-toggle-label`} className="flex flex-col">
      <Label className="font-semibold">{label}</Label>
      {subLabel && <p className="text-sm font-normal text-slate-500">{subLabel}</p>}
      <div className="mt-2 flex overflow-hidden rounded-md border border-gray-300 p-2">
        {options.map((option) => (
          <label
            key={option.value}
            htmlFor={option.value.toString()}
            className={cn(
              "flex-1 cursor-pointer rounded-md py-2 text-center text-sm",
              selectedOption === option.value ? "bg-slate-100" : "bg-white",
              "focus:ring-brand-dark focus:outline-none focus:ring-2 focus:ring-opacity-50"
            )}>
            <input
              type="radio"
              name={id}
              id={option.value.toString()}
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
