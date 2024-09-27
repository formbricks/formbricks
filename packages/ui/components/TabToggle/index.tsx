import React, { useState } from "react";
import { cn } from "@formbricks/lib/cn";

interface Option<T> {
  value: T;
  label: string;
}

interface TabToggleProps<T> {
  id: string;
  options: Option<T>[];
  defaultSelected?: T;
  onChange: (value: T) => void;
}

export const TabToggle = <T extends string | number>({
  id,
  options,
  defaultSelected,
  onChange,
}: TabToggleProps<T>) => {
  const [selectedOption, setSelectedOption] = useState<T | undefined>(defaultSelected);

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
            htmlFor={option.value.toString()}
            className={cn(
              "flex-1 cursor-pointer rounded-md py-2 text-center text-sm text-slate-800",
              selectedOption === option.value && "bg-white",
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
