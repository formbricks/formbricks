import React, { useState } from "react";
import { cn } from "@/lib/cn";
import { Label } from "@/modules/ui/components/label";

interface Option<T> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface StylingTabsProps<T> {
  readonly id: string;
  readonly options: Option<T>[];
  readonly defaultSelected?: T;
  readonly onChange: (value: T) => void;
  readonly className?: string;
  readonly tabsContainerClassName?: string;

  readonly label?: string;
  readonly subLabel?: string;
  readonly activeTabClassName?: string;
  readonly inactiveTabClassName?: string;
}

export const StylingTabs = <T extends string | number>({
  id,
  options,
  defaultSelected,
  onChange,
  className,
  tabsContainerClassName,
  label,
  subLabel,
  activeTabClassName,
  inactiveTabClassName,
}: StylingTabsProps<T>) => {
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
        className={cn("flex overflow-hidden rounded-md border border-slate-300 p-2", tabsContainerClassName)}>
        {options.map((option) => {
          // Scoped to the group, so two tab groups on a page with the same option never share an id.
          const optionId = `${id}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-4 rounded-md py-2 text-center text-sm",
                selectedOption === option.value ? "bg-slate-100" : "bg-white",
                "focus:ring-2 focus:ring-brand-dark/50 focus:outline-hidden",
                selectedOption === option.value ? activeTabClassName : inactiveTabClassName
              )}>
              <input
                type="radio"
                name={id}
                id={optionId}
                value={option.value.toString()}
                checked={selectedOption === option.value}
                onChange={handleChange}
                className="sr-only"
              />
              <span className="text-slate-900">{option.label}</span>
              {option.icon && <div>{option.icon}</div>}
            </label>
          );
        })}
      </div>
    </div>
  );
};
