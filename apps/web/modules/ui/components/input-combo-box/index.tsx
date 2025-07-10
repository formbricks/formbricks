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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Input } from "@/modules/ui/components/input";
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
  children?: TComboboxOption[];
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

// Helper to flatten all options and their children
function flattenOptions(options?: TComboboxOption[]): TComboboxOption[] {
  if (!options) return [];
  return options.flatMap((option) => [option, ...(option.children ? flattenOptions(option.children) : [])]);
}

export const InputCombobox: React.FC<InputComboboxProps> = ({
  id = "temp",
  showSearch = true,
  searchPlaceholder = "Search",
  options,
  groupedOptions,
  value,
  onChangeValue,
  inputProps,
  clearable = false,
  withInput = false,
  allowMultiSelect = false,
  showCheckIcon = false,
  comboboxClasses,
  emptyDropdownText,
}) => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);
  const [inputType, setInputType] = useState<"dropdown" | "input" | null>(null);
  const [localValue, setLocalValue] = useState<string | number | string[] | null>(null);

  const validOptions = useMemo(() => {
    if (options?.length) return flattenOptions(options);
    if (groupedOptions?.length) return flattenOptions(groupedOptions.flatMap((group) => group.options));
    return [];
  }, [options, groupedOptions]);

  useEffect(() => {
    if (value === null || value === undefined) {
      setLocalValue(null);
      setInputType(null);
    } else if (Array.isArray(value)) {
      if (value.length) {
        setLocalValue(value);
        setInputType("dropdown");
      }
    } else {
      const opt = validOptions?.find((o) => o.value === value);
      if (opt) {
        setLocalValue(opt.value);
        setInputType("dropdown");
      } else if (withInput) {
        setLocalValue(value);
        setInputType("input");
      } else {
        setLocalValue(null);
        setInputType(null);
      }
    }
  }, [value, validOptions, withInput]);

  const handleMultiSelect = (option: TComboboxOption) => {
    const arr = Array.isArray(localValue) ? [...localValue] : [];
    const exists = arr.includes(option.value as string);
    const newArr = exists ? arr.filter((v) => v !== option.value) : [...arr, option.value];
    if (!newArr.length) {
      onChangeValue([], option);
      setInputType(null);
    } else {
      onChangeValue(newArr as string[], option);
    }
    setLocalValue(newArr as string[]);
  };

  const handleSelect = (option: TComboboxOption) => {
    setInputType("dropdown");
    if (allowMultiSelect) {
      handleMultiSelect(option);
    } else {
      onChangeValue(option.value, option);
      setLocalValue(option.value);
      setOpen(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.type === "number" ? +e.target.value : e.target.value;
    if (val === "") onChangeValue("", undefined, true);
    setInputType("input");
    setLocalValue(val);
    onChangeValue(val, undefined, true);
  };

  const getDisplayValue = useMemo(() => {
    if (Array.isArray(localValue)) {
      return localValue.map((v, i) => {
        const opt = validOptions?.find((o) => o.value === v);
        if (!opt) return null;
        return (
          <Fragment key={i}>
            {i > 0 && <span>, </span>}
            <div className="flex items-center gap-2">
              {opt.icon && <opt.icon className="h-5 w-5 shrink-0 text-slate-400" />}
              {opt.imgSrc && <Image src={opt.imgSrc} alt={opt.label} width={24} height={24} />}
              <span>{opt.label}</span>
            </div>
          </Fragment>
        );
      });
    }

    const opt = validOptions?.find((o) => o.value === localValue);
    if (!opt) return null;
    return (
      <div className="flex items-center gap-2 truncate">
        {opt.icon && <opt.icon className="h-5 w-5 shrink-0 text-slate-400" />}
        {opt.imgSrc && <Image src={opt.imgSrc} alt={opt.label} width={24} height={24} />}
        <span>{opt.label}</span>
      </div>
    );
  }, [localValue, validOptions]);

  const handleClear = () => {
    setInputType(null);
    setLocalValue(null);
    onChangeValue("");
  };

  const isSelected = (option: TComboboxOption) =>
    Array.isArray(localValue) ? localValue.includes(option.value as string) : localValue === option.value;

  return (
    <div
      className={cn(
        "group/icon flex max-w-[440px] overflow-hidden rounded-md border border-slate-300 hover:border-slate-400",
        comboboxClasses
      )}>
      {withInput && inputType !== "dropdown" && (
        <Input
          id={`${id}-input`}
          className="min-w-0 rounded-none border-0 border-r border-slate-300"
          {...inputProps}
          value={localValue ?? ""}
          onChange={onInputChange}
        />
      )}

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <div
            id={id}
            role="combobox"
            aria-controls="options"
            aria-expanded={open}
            className={cn("flex h-10 w-full cursor-pointer items-center justify-end bg-white pr-2", {
              "w-10 justify-center pr-0": withInput && inputType !== "dropdown",
            })}>
            {inputType === "dropdown" && (
              <div className="ellipsis flex w-full gap-2 truncate px-2">{getDisplayValue}</div>
            )}
            {clearable && inputType === "dropdown" ? (
              <XIcon className="h-5 w-5 text-slate-300 hover:text-slate-400" onClick={handleClear} />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-slate-300 group-hover/icon:text-slate-400" />
            )}
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="bottom" align="start" className="p-0">
          <Command className="h-full max-h-[400px] overflow-y-auto">
            {showSearch ? (
              <div className="border-b border-slate-100 px-3">
                <CommandInput
                  placeholder={searchPlaceholder}
                  className="h-8 border-none placeholder-slate-300 outline-none"
                />
              </div>
            ) : (
              <button autoFocus className="sr-only" aria-hidden />
            )}

            <CommandList className="p-1">
              <CommandEmpty className="mx-2 my-0 text-xs font-semibold text-slate-500">
                {emptyDropdownText ? t(emptyDropdownText) : t("environments.surveys.edit.no_option_found")}
              </CommandEmpty>

              {options && options.length > 0 && (
                <CommandGroup className="p-0">
                  {options.map((opt) => (
                    <CommandItem key={opt.value} onSelect={() => handleSelect(opt)} className="truncate px-2">
                      {showCheckIcon && isSelected(opt) && (
                        <CheckIcon className="mr-2 h-4 w-4 text-slate-300 hover:text-slate-400" />
                      )}
                      {opt.icon && <opt.icon className="mr-2 h-5 w-5 text-slate-400" />}
                      {opt.imgSrc && (
                        <Image
                          src={opt.imgSrc}
                          alt={opt.label}
                          width={24}
                          height={24}
                          className="mr-2 shrink-0"
                        />
                      )}
                      <span className="truncate">{opt.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {groupedOptions?.map((group, gi) => (
                <Fragment key={gi}>
                  {gi > 0 && <CommandSeparator className="bg-slate-300" />}
                  <CommandGroup className="p-0" tabIndex={0}>
                    <div className="px-2 pb-2 text-sm font-medium text-slate-500">{group.label}</div>
                    {group.options.map((opt) =>
                      opt.children ? (
                        <DropdownMenuSub key={opt.value}>
                          <DropdownMenuSubTrigger className="p-0">
                            <CommandItem className="flex w-full justify-between truncate px-2">
                              {showCheckIcon && isSelected(opt) && (
                                <CheckIcon className="mr-2 h-4 w-4 text-slate-300 hover:text-slate-400" />
                              )}
                              {opt.icon && <opt.icon className="mr-2 h-5 w-5 text-slate-400" />}
                              {opt.imgSrc && (
                                <Image
                                  src={opt.imgSrc}
                                  alt={opt.label}
                                  width={24}
                                  height={24}
                                  className="mr-2 shrink-0"
                                />
                              )}
                              <span className="flex-1 truncate">{opt.label}</span>
                            </CommandItem>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent alignOffset={4} className="w-48 p-1">
                            {opt.children.map((child) => (
                              <div className="flex flex-col">
                                {child.children && child.children.length > 0 ? (
                                  <p className="mb-2 px-2 text-sm font-medium text-slate-500">
                                    {child.label}
                                  </p>
                                ) : (
                                  <DropdownMenuItem key={child.value} onSelect={() => handleSelect(child)}>
                                    {child.label}
                                  </DropdownMenuItem>
                                )}
                                {child.children?.map((subChild) => (
                                  <DropdownMenuItem
                                    key={subChild.value}
                                    onSelect={() => handleSelect(subChild)}>
                                    {subChild.label}
                                  </DropdownMenuItem>
                                ))}

                                {child.children && child.children.length > 0 && <DropdownMenuSeparator />}
                              </div>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      ) : (
                        <CommandItem
                          key={opt.value}
                          onSelect={() => handleSelect(opt)}
                          className="truncate px-2">
                          {showCheckIcon && isSelected(opt) && (
                            <CheckIcon className="mr-2 h-4 w-4 text-slate-300 hover:text-slate-400" />
                          )}
                          {opt.icon && <opt.icon className="mr-2 h-5 w-5 text-slate-400" />}
                          {opt.imgSrc && (
                            <Image
                              src={opt.imgSrc}
                              alt={opt.label}
                              width={24}
                              height={24}
                              className="mr-2 shrink-0"
                            />
                          )}
                          <span className="truncate">{opt.label}</span>
                        </CommandItem>
                      )
                    )}
                  </CommandGroup>
                </Fragment>
              ))}
            </CommandList>
          </Command>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
