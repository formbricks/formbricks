import debounce from "lodash/debounce";
import { CheckIcon, ChevronDownIcon, LucideProps, XIcon } from "lucide-react";
import Image from "next/image";
import React, { ForwardRefExoticComponent, RefAttributes, useEffect, useMemo, useState } from "react";
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

export interface TComboboxOption {
  icon?: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
  imgSrc?: string;
  label: string;
  value: string | number;
  meta?: Record<string, string>;
}

export interface TComboboxGroupedOption {
  label: string;
  value: string | number;
  options: TComboboxOption[];
}

export interface InputComboboxProps {
  id: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  options?: TComboboxOption[];
  groupedOptions?: TComboboxGroupedOption[];
  value?: string | number | string[] | null;
  onChangeValue: (value: string | number | string[], option?: TComboboxOption, fromInput?: boolean) => void;
  inputProps?: Omit<React.ComponentProps<typeof Input>, "value" | "onChange">;
  clearable?: boolean;
  withInput?: boolean;
  allowMultiSelect?: boolean;
  showCheckIcon?: boolean;
  comboboxClasses?: string;
  emptyDropdownText?: string;
}

export const InputCombobox = ({
  id = "temp",
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
  emptyDropdownText = "No option found.",
}: InputComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState<TComboboxOption | TComboboxOption[] | string | number | null>(
    null
  );
  const [inputType, setInputType] = useState<"dropdown" | "input" | null>(null);
  const [inputValue, setInputValue] = useState(value || "");

  // Debounced function to call onChangeValue
  const debouncedOnChangeValue = useMemo(
    () => debounce((val) => onChangeValue(val, undefined, true), 300),
    [onChangeValue]
  );

  useEffect(() => {
    // Sync inputValue when value changes externally
    setInputValue(value || "");
  }, [value]);

  useEffect(() => {
    const validOptions = options?.length ? options : groupedOptions?.flatMap((group) => group.options);

    if (value === null || value === undefined) {
      setLocalValue("");
      setInputType(null);
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
          } else {
            setLocalValue(null);
            setInputType(null);
          }
        }
      }
    }
  }, [value, options, groupedOptions, inputType, withInput]);

  const handleMultiSelect = (option: TComboboxOption) => {
    if (Array.isArray(localValue)) {
      const doesExist = localValue.find((item) => item.value === option.value);
      const newValue = doesExist
        ? localValue.filter((item) => item.value !== option.value)
        : [...localValue, option];

      if (!newValue.length) {
        onChangeValue([]);
        setInputType(null);
      }
      onChangeValue(newValue.map((item) => item.value) as string[], option);
      setLocalValue(newValue);
    } else {
      onChangeValue([option.value] as string[], option);
      setLocalValue([option]);
    }
  };

  const handleSelect = (option: TComboboxOption) => {
    if (inputType !== "dropdown") {
      setInputType("dropdown");
    }

    if (allowMultiSelect) {
      handleMultiSelect(option);
    } else {
      onChangeValue(option.value, option);
      setLocalValue(option);
      setOpen(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputType = e.target.type;
    const value = e.target.value;

    if (value === "") {
      setLocalValue("");
      setInputValue("");
      debouncedOnChangeValue("");
    }

    if (inputType !== "input") {
      setInputType("input");
    }

    const val = inputType === "number" ? Number(value) : value;

    // Set the local input value immediately
    setInputValue(val);
    setLocalValue(val);

    // Trigger the debounced onChangeValue
    debouncedOnChangeValue(val);
  };

  const getDisplayValue = useMemo(() => {
    if (Array.isArray(localValue)) {
      return localValue.map((item, idx) => (
        <>
          {idx !== 0 && <span>,</span>}
          <div className="flex items-center gap-2">
            {item.icon && <item.icon className="h-5 w-5 shrink-0 text-slate-400" />}
            {item.imgSrc && <Image src={item.imgSrc} alt={item.label} width={24} height={24} />}
            <span>{item.label}</span>
          </div>
        </>
      ));
    } else if (localValue && typeof localValue === "object") {
      return (
        <div className="flex items-center gap-2 truncate">
          {localValue.icon && <localValue.icon className="h-5 w-5 shrink-0 text-slate-400" />}
          {localValue.imgSrc && (
            <Image src={localValue.imgSrc} alt={localValue.label} width={24} height={24} />
          )}
          <span className="truncate">{localValue.label}</span>
        </div>
      );
    }
  }, [localValue]);

  const handleClear = () => {
    setInputType(null);
    onChangeValue("");
    setLocalValue(null);
  };

  const isSelected = (option: TComboboxOption) => {
    if (typeof localValue === "object") {
      if (Array.isArray(localValue)) {
        return localValue.find((item) => item.value === option.value) !== undefined;
      }
      return localValue?.value === option.value;
    }
  };

  return (
    <div
      className={cn(
        "group/icon flex max-w-[440px] overflow-hidden rounded-md border border-slate-300 transition-colors duration-200 ease-in-out hover:border-slate-400",
        comboboxClasses
      )}>
      {withInput && inputType !== "dropdown" && (
        <Input
          className="min-w-0 rounded-none border-0 border-r border-slate-300 bg-white focus:border-slate-400"
          {...inputProps}
          id={`${id}-input`}
          value={inputValue as string | number}
          onChange={onInputChange}
        />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            id={id}
            role="combobox"
            aria-controls="options"
            aria-expanded={open}
            className={cn(
              "flex h-10 w-full shrink-0 cursor-pointer items-center justify-end rounded-md bg-white pr-2",
              { "w-10 justify-center pr-0": withInput && inputType !== "dropdown" }
            )}>
            {inputType === "dropdown" && (
              <div className="ellipsis flex w-full gap-2 truncate px-2">{getDisplayValue}</div>
            )}
            {clearable && inputType === "dropdown" ? (
              <XIcon className="h-5 w-5 shrink-0 text-slate-300 hover:text-slate-400" onClick={handleClear} />
            ) : (
              <ChevronDownIcon className="h-5 w-5 shrink-0 text-slate-300 transition-colors duration-200 ease-in-out group-hover/icon:text-slate-400" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className={cn("w-auto max-w-[400px] overflow-y-auto truncate p-0", {
            "px-2 pt-2": showSearch,
          })}>
          <Command>
            {showSearch && (
              <CommandInput
                placeholder={searchPlaceholder}
                className="h-8 border-slate-400 bg-white placeholder-slate-300"
              />
            )}
            <CommandList className="m-1">
              <CommandEmpty className="mx-2 my-0 text-xs font-semibold text-slate-500">
                {emptyDropdownText}
              </CommandEmpty>
              {options && options.length > 0 && (
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      onSelect={() => handleSelect(option)}
                      title={option.label}
                      className="cursor-pointer truncate">
                      {showCheckIcon && isSelected(option) && (
                        <CheckIcon className="mr-2 h-4 w-4 text-slate-300 hover:text-slate-400" />
                      )}
                      {option.icon && <option.icon className="mr-2 h-5 w-5 shrink-0 text-slate-400" />}
                      {option.imgSrc && (
                        <Image
                          src={option.imgSrc}
                          alt={option.label}
                          width={24}
                          height={24}
                          className="mr-2 shrink-0"
                        />
                      )}
                      <span className="truncate">{option.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {groupedOptions?.map((group, idx) => (
                <>
                  {idx !== 0 && <CommandSeparator key={idx} className="bg-slate-300" />}
                  <CommandGroup heading={group.label}>
                    {group.options.map((option) => (
                      <CommandItem
                        key={option.value}
                        onSelect={() => handleSelect(option)}
                        className="cursor-pointer truncate">
                        {showCheckIcon && isSelected(option) && (
                          <CheckIcon className="mr-2 h-4 w-4 text-slate-300 hover:text-slate-400" />
                        )}
                        {option.icon && <option.icon className="mr-2 h-5 w-5 shrink-0 text-slate-400" />}
                        {option.imgSrc && (
                          <Image
                            src={option.imgSrc}
                            alt={option.label}
                            width={24}
                            height={24}
                            className="mr-2 shrink-0"
                          />
                        )}
                        <span className="truncate">{option.label}</span>
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
