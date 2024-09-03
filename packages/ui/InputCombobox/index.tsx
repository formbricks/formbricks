import { CheckIcon, ChevronDownIcon, LucideProps, XIcon } from "lucide-react";
import React, { useEffect, useMemo } from "react";
import { ForwardRefExoticComponent, RefAttributes } from "react";
import { cn } from "@formbricks/lib/cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../Command";
import { Input } from "../Input";
import { Popover, PopoverContent, PopoverTrigger } from "../Popover";

export interface ComboboxOption<T = string | number> {
  icon?: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
  label: string;
  value: T;
  meta?: Record<string, string>;
}

export interface ComboboxGroupedOption {
  label: string;
  value: string | number;
  options: ComboboxOption[];
}

interface InputComboboxProps<T> {
  showSearch?: boolean;
  searchPlaceholder?: string;
  options?: ComboboxOption<T>[];
  groupedOptions?: ComboboxGroupedOption[];
  value?: string | number | string[] | null;
  onChangeValue: (value: T | T[], option?: ComboboxOption) => void;
  inputProps?: Omit<React.ComponentProps<typeof Input>, "value" | "onChange">;
  clearable?: boolean;
  withInput?: boolean;
  comboboxSize?: "sm" | "lg";
  allowMultiSelect?: boolean;
  showCheckIcon?: boolean;
  comboboxClasses?: string;
}

export const InputCombobox = ({
  showSearch = true,
  searchPlaceholder = "Search...",
  options,
  inputProps,
  groupedOptions,
  value,
  onChangeValue,
  clearable = false,
  withInput = false,
  allowMultiSelect = false,
  showCheckIcon = false,
  comboboxClasses,
}: InputComboboxProps<string | number>) => {
  const [open, setOpen] = React.useState(false);
  const [localValue, setLocalValue] = React.useState<
    ComboboxOption | ComboboxOption[] | string | number | null
  >(null);
  const [inputType, setInputType] = React.useState<"dropdown" | "input" | null>(null);

  showCheckIcon = allowMultiSelect ? true : showCheckIcon;

  useEffect(() => {
    const validOptions = options?.length ? options : groupedOptions?.flatMap((group) => group.options);

    if (value === null || value === undefined) {
      setLocalValue(null);
    } else {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          setLocalValue(validOptions?.filter((option) => value.includes(option.value as string)) || null);
          if (inputType !== "dropdown") {
            setInputType("dropdown");
          }
        }
      } else {
        const option = validOptions?.find((option) => option.value === value);
        if (option) {
          setLocalValue(option);
          if (inputType !== "dropdown") {
            setInputType("dropdown");
          }
        } else {
          if (withInput) {
            setLocalValue(value);
            if (inputType !== "input") {
              setInputType("input");
            }
          }
        }
      }
    }
  }, [value, options, groupedOptions, inputType, withInput]);

  const handleSelect = (option: ComboboxOption) => {
    if (inputType !== "dropdown") {
      setInputType("dropdown");
    }

    if (allowMultiSelect) {
      if (Array.isArray(localValue)) {
        const doesExist = localValue.find((item) => item.value === option.value);
        const newValue = doesExist
          ? localValue.filter((item) => item.value !== option.value)
          : [...localValue, option];

        if (!newValue.length) {
          onChangeValue("");
          setInputType(null);
        }
        onChangeValue(newValue.map((item) => item.value));
        setLocalValue(newValue);
      } else {
        onChangeValue([option.value], option);
        setLocalValue([option]);
      }
    } else {
      onChangeValue(option.value, option);
      setLocalValue(option);
      setOpen(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "") {
      setLocalValue(null);
      onChangeValue("");
    }

    if (inputType !== "input") {
      setInputType("input");
    }

    setLocalValue(value);
    onChangeValue(value);
  };

  const getDisplayValue = useMemo(() => {
    if (Array.isArray(localValue)) {
      return localValue.map((item, idx) => (
        <>
          {idx !== 0 && <span>,</span>}
          <div className="flex items-center gap-2">
            {item.icon && <item.icon className="h-5 w-5 shrink-0 text-slate-400" />}
            <span>{item.label}</span>
          </div>
        </>
      ));
    } else if (localValue && typeof localValue === "object") {
      return (
        <div className="flex items-center gap-2">
          {localValue.icon && <localValue.icon className="h-5 w-5 shrink-0 text-slate-400" />}
          <span>{localValue.label}</span>
        </div>
      );
    }
  }, [localValue]);

  const handleClear = () => {
    setInputType(null);
    onChangeValue("");
    setLocalValue(null);
  };

  return (
    <div className={cn("flex overflow-hidden rounded-md border border-slate-300", comboboxClasses)}>
      {withInput && inputType !== "dropdown" && (
        <Input
          className="min-w-0 rounded-none border-0 border-r border-slate-300 bg-white focus:border-slate-300"
          {...inputProps}
          value={value as string | number}
          onChange={onInputChange}
        />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            role="combobox"
            aria-controls="options"
            aria-expanded={open}
            className={cn("flex h-10 w-full cursor-pointer items-center justify-center rounded-md bg-white")}>
            <div className="ellipsis flex w-full gap-2 truncate px-2">{getDisplayValue}</div>
            {clearable && inputType === "dropdown" ? (
              <XIcon className="shrink-0 text-slate-300" onClick={handleClear} />
            ) : (
              <ChevronDownIcon className="shrink-0 text-slate-300" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            "max-h-[400px] w-[200px] overflow-y-auto border border-slate-400 bg-slate-50 p-0 shadow-none",
            {
              "pt-2": showSearch,
            }
          )}>
          <Command>
            {showSearch && (
              <CommandInput
                placeholder={searchPlaceholder}
                className="h-8 border-slate-400 bg-white placeholder-slate-300"
              />
            )}
            <CommandList>
              <CommandEmpty>No option found.</CommandEmpty>
              {options && options.length > 0 ? (
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      onSelect={() => handleSelect(option)}
                      className="cursor-pointer truncate">
                      {showCheckIcon &&
                        ((allowMultiSelect &&
                          Array.isArray(localValue) &&
                          localValue.find((item) => item.value === option.value)) ||
                          (!allowMultiSelect &&
                            typeof localValue === "string" &&
                            localValue === option.value)) && (
                          <CheckIcon className="mr-2 h-4 w-4 text-slate-300" />
                        )}
                      {option.icon && <option.icon className="mr-2 h-5 w-5 shrink-0 text-slate-400" />}
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {groupedOptions?.map((group, idx) => (
                <>
                  {idx !== 0 && <CommandSeparator key={idx} className="bg-slate-300" />}
                  <CommandGroup heading={group.label}>
                    {group.options.map((option) => (
                      <CommandItem
                        key={option.value}
                        onSelect={() => handleSelect(option)}
                        className="cursor-pointer truncate">
                        {showCheckIcon &&
                          ((allowMultiSelect &&
                            Array.isArray(localValue) &&
                            localValue.find((item) => item.value === option.value)) ||
                            (!allowMultiSelect &&
                              typeof localValue === "string" &&
                              localValue === option.value)) && (
                            <CheckIcon className="mr-2 h-4 w-4 shrink-0 text-slate-300" />
                          )}
                        {option.icon && <option.icon className="mr-2 h-5 w-5 shrink-0 text-slate-400" />}
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
