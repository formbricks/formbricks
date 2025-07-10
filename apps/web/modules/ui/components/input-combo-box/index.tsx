"use client";

import { cn } from "@/lib/cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/modules/ui/components/command";
import { Input } from "@/modules/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { useTranslate } from "@tolgee/react";
import { CheckIcon, ChevronDownIcon, LucideProps, XIcon } from "lucide-react";
import Image from "next/image";
import React, {
  ForwardRefExoticComponent,
  Fragment,
  RefAttributes,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  searchPlaceholder = "Search",
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
  emptyDropdownText,
}: InputComboboxProps) => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);
  const [inputType, setInputType] = useState<"dropdown" | "input" | null>(null);
  const [localValue, setLocalValue] = useState<string | number | string[] | null>(null);

  const validOptions = useMemo(() => {
    if (options?.length) {
      return options;
    }

    return groupedOptions?.flatMap((group) => group.options);
  }, [options, groupedOptions]);

  useEffect(() => {
    if (value === null || value === undefined) {
      setLocalValue(null);
      setInputType(null);
    } else {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          setLocalValue(value);

          if (inputType !== "dropdown") {
            setInputType("dropdown");
          }
        }
      } else {
        const option = validOptions?.find((option) => option.value === value);
        if (option) {
          setLocalValue(option.value);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleMultiSelect = (option: TComboboxOption) => {
    if (Array.isArray(localValue)) {
      const doesExist = localValue.includes(option.value as string);
      const newValue = doesExist
        ? localValue.filter((item) => item !== option.value)
        : [...localValue, option.value];

      if (!newValue.length) {
        onChangeValue([]);
        setInputType(null);
      }
      onChangeValue(newValue as string[], option);
      setLocalValue(newValue as string[]);
    } else {
      onChangeValue([option.value] as string[], option);
      setLocalValue([option.value] as string[]);
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
      setLocalValue(option.value);
      setOpen(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputType = e.target.type;
    const value = e.target.value;
    setLocalValue(null);

    if (value === "") {
      onChangeValue("", undefined, true);
    }

    if (inputType !== "input") {
      setInputType("input");
    }

    const val = inputType === "number" ? Number(value) : value;
    setLocalValue(val);

    onChangeValue(val, undefined, true);
  };

  const getDisplayValue = useMemo(() => {
    if (Array.isArray(localValue)) {
      return localValue.map((item, idx) => {
        const option = validOptions?.find((opt) => opt.value === item);

        if (!option) {
          return null;
        }

        return (
          <Fragment key={idx}>
            {idx !== 0 && <span>,</span>}
            <div className="flex items-center gap-2">
              {option.icon && <option.icon className="h-5 w-5 shrink-0 text-slate-400" />}
              {option.imgSrc && <Image src={option.imgSrc} alt={option.label} width={24} height={24} />}
              <span>{option.label}</span>
            </div>
          </Fragment>
        );
      });
    } else {
      const option = validOptions?.find((opt) => opt.value === localValue);

      if (!option) {
        return null;
      }

      return (
        <div className="flex items-center gap-2 truncate">
          {option.icon && <option.icon className="h-5 w-5 shrink-0 text-slate-400" />}
          {option.imgSrc && <Image src={option.imgSrc} alt={option.label} width={24} height={24} />}
          <span className="truncate">{option.label}</span>
        </div>
      );
    }
  }, [localValue, validOptions]);

  const handleClear = () => {
    setInputType(null);
    onChangeValue("");
    setLocalValue(null);
  };

  const isSelected = (option: TComboboxOption) => {
    if (typeof localValue === "object") {
      if (Array.isArray(localValue)) {
        return localValue.find((item) => item === option.value) !== undefined;
      }

      return localValue === option.value;
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
          value={localValue ?? undefined}
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
        <PopoverContent className={cn("h-full w-auto max-w-[400px] truncate p-0")}>
          <Command className="h-full max-h-[400px] overflow-y-auto">
            {showSearch ? (
              <div className="border-b border-slate-100 px-3">
                <CommandInput
                  placeholder={searchPlaceholder}
                  className="h-8 border-none bg-white placeholder-slate-300 outline-none"
                />
              </div>
            ) : (
              <button autoFocus aria-hidden="true" className="sr-only" />
            )}
            <CommandList className="p-1">
              <CommandEmpty className="mx-2 my-0 text-xs font-semibold text-slate-500">
                {emptyDropdownText ? t(emptyDropdownText) : t("environments.surveys.edit.no_option_found")}
              </CommandEmpty>
              {options && options.length > 0 && (
                <CommandGroup className="p-0">
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
                <div key={idx}>
                  {idx !== 0 && <CommandSeparator key={idx} className="bg-slate-300" />}
                  <CommandGroup className="p-0">
                    <div className="px-2 pb-2 text-sm font-medium text-slate-500">{group.label}</div>
                    {group.options.map((option) => (
                      <CommandItem
                        key={option.value}
                        onSelect={() => handleSelect(option)}
                        className="cursor-pointer truncate px-2">
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
                </div>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
