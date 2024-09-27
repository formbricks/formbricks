import React, { useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { Label } from "../Label";

interface Option<T> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps<T> {
  id: string;
  options: Option<T>[];
  defaultSelected?: T;
  onChange: (value: T) => void;
  className?: string;
  tabsContainerClassName?: string;

  label?: string;
  subLabel?: string;
}

export const Tabs = <T extends string | number>({
  id,
  options,
  defaultSelected,
  onChange,
  className,
  tabsContainerClassName,
  label,
  subLabel,
}: TabsProps<T>) => {
  const [selectedOption, setSelectedOption] = useState<T | undefined>(defaultSelected);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value as T;
    setSelectedOption(value);
    onChange(value);
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={`${id}-toggle-label`}
      className={cn("flex flex-col gap-2", className)}>
      <>
        {label && <Label className="font-semibold">{label}</Label>}
        {subLabel && <p className="text-sm font-normal text-slate-500">{subLabel}</p>}
      </>

      <div
        className={cn("flex overflow-hidden rounded-md border border-gray-300 p-2", tabsContainerClassName)}>
        {options.map((option) => (
          <label
            key={option.value}
            htmlFor={option.value.toString()}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center gap-4 rounded-md py-2 text-center text-sm",
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
            <span className="text-slate-900">{option.label}</span>
            <div>{option.icon}</div>
          </label>
        ))}
      </div>
    </div>
  );
};
