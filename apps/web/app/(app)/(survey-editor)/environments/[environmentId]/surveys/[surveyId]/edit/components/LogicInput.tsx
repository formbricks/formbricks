import { CheckIcon, ChevronDownIcon } from "lucide-react";
import React, { ReactNode } from "react";
import { cn } from "@formbricks/lib/cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@formbricks/ui/Command";
import { Input } from "@formbricks/ui/Input";
import { Popover, PopoverContent, PopoverTrigger } from "@formbricks/ui/Popover";

interface LogicInputProps {
  showSearch?: boolean;
  searchPlaceholder?: string;
  options?: { label: string | ReactNode; value: string }[];
  groupedOptions?: {
    label: string;
    value: string;
    options: { label: string | ReactNode; value: string }[];
  }[];
  selected: string | string[] | null;
  onChangeValue: (option: string | string[]) => void;
  inputProps?: React.ComponentProps<typeof Input>;
  withInput?: boolean;
  size?: "sm" | "lg";
  allowMultiSelect?: boolean;
}

export const LogicInput = ({
  showSearch = true,
  searchPlaceholder = "Search...",
  options,
  inputProps,
  groupedOptions,
  selected,
  onChangeValue,
  withInput = false,
  size = "sm",
  allowMultiSelect = false,
}: LogicInputProps) => {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState<string | string[] | null>(() => {
    if (!selected) {
      if (allowMultiSelect) {
        return [];
      }
    }
    return selected;
  });

  const handleSelect = (option: string) => {
    if (allowMultiSelect) {
      if (Array.isArray(value)) {
        const newValue = value.includes(option)
          ? value.filter((item) => item !== option)
          : [...value, option];
        onChangeValue(newValue);
        setValue(newValue);
      } else {
        onChangeValue([option]);
        setValue([option]);
      }
    } else {
      onChangeValue(option);
      setValue(option);
      setOpen(false);
    }
  };

  return (
    <div className="flex">
      {withInput && <Input className="w-[200px] rounded-r-none border border-slate-300" {...inputProps} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            role="combobox"
            aria-controls="options"
            aria-expanded={open}
            className={cn(
              "flex h-10 cursor-pointer items-center justify-center rounded-md border border-slate-300",
              {
                "rounded-r-none": withInput,
                "w-10": size === "sm",
                "w-[200px] justify-between gap-2 p-2": size === "lg",
              }
            )}>
            {size === "lg" && (
              <div>
                {Array.isArray(value)
                  ? value
                      .map((item) => options?.find((option) => option.value === item)?.label || item)
                      .join(", ")
                  : value || ""}
              </div>
            )}
            <ChevronDownIcon
              className="text-slate-300"
              height={size === "sm" ? 20 : 16}
              width={size === "sm" ? 20 : 16}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent
          className={cn("w-[200px] border border-slate-400 bg-slate-50 p-0 shadow-none", {
            "pt-2": size === "sm",
          })}>
          <Command>
            {showSearch && (
              <CommandInput
                placeholder={searchPlaceholder}
                className="h-8 border-slate-400 bg-white placeholder-slate-300"
              />
            )}
            <CommandList>
              <CommandEmpty>No option found.</CommandEmpty>
              <CommandGroup>
                {options?.map((option) => (
                  <CommandItem key={option.value} onSelect={() => handleSelect(option.value)}>
                    {allowMultiSelect && Array.isArray(value) && value.includes(option.value) && (
                      <CheckIcon className="mr-2 h-4 w-4 text-slate-300" />
                    )}
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>

              {groupedOptions?.map((group, idx) => (
                <>
                  {idx !== 0 && <CommandSeparator key={idx} className="bg-slate-300" />}
                  <CommandGroup heading={group.value}>
                    {group.options.map((option) => (
                      <CommandItem key={option.value} onSelect={() => handleSelect(option.value)}>
                        {allowMultiSelect && Array.isArray(value) && value.includes(option.value) && (
                          <CheckIcon className="mr-2 h-4 w-4 text-slate-300" />
                        )}
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
