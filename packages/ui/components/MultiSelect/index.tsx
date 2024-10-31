import clsx from "clsx";
import { ChevronDownIcon, ChevronUpIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useClickOutside } from "@formbricks/lib/utils/hooks/useClickOutside";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "../Command";

interface TOption<T> {
  label: string;
  value: T;
}

interface MultiSelectProps<T extends string, K extends TOption<T>["value"] | TOption<T>["value"][]> {
  options: TOption<T>[];
  isMultiple?: boolean;
  disabled?: boolean;
  isDisabledComboBox?: boolean;
  value?: K;
  onChange: (value: K) => void;
}

export const MultiSelect = <T extends string, K extends TOption<T>["value"] | TOption<T>["value"][]>({
  options,
  isMultiple = true,
  disabled,
  isDisabledComboBox,
  value,
  onChange,
}: MultiSelectProps<T, K>) => {
  const [open, setOpen] = useState(false);

  const isOptionSelected = (optionValue: T) => {
    if (Array.isArray(value)) {
      return value.includes(optionValue);
    }
    return value === optionValue;
  };

  const handleSelect = (optionValue: T) => {
    if (isMultiple) {
      if (Array.isArray(value)) {
        if (isOptionSelected(optionValue)) {
          onChange(value.filter((v) => v !== optionValue) as K);
        } else {
          onChange([...value, optionValue] as K);
        }
      } else {
        onChange([optionValue] as K);
      }
    } else {
      onChange(optionValue as K);
      setOpen(false);
    }
  };

  const filteredOptions = options.filter((option) => {
    if (Array.isArray(value)) {
      return !value.includes(option.value);
    }
    return option.value !== value;
  });

  const commandRef = useRef<HTMLDivElement>(null);
  useClickOutside(commandRef, () => setOpen(false));

  return (
    <Command ref={commandRef} className="overflow-visible bg-transparent">
      <div
        onClick={() => !disabled && !isDisabledComboBox && setOpen((open) => !open)}
        className={clsx(
          "group flex items-center justify-between rounded-md rounded-l-none border bg-white px-3 py-2 text-sm",
          disabled || isDisabledComboBox ? "opacity-50" : "cursor-pointer"
        )}>
        {value && (Array.isArray(value) ? value.length > 0 : !!value) ? (
          !Array.isArray(value) ? (
            <p className="text-slate-600">{options.find((option) => option.value === value)?.label}</p>
          ) : (
            <div className="no-scrollbar flex gap-3 overflow-auto" onClick={(e) => e.stopPropagation()}>
              {value.map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => handleSelect(val)}
                  className="w-30 flex items-center whitespace-nowrap bg-slate-100 px-2 text-slate-600">
                  {options.find((option) => option.value === val)?.label}
                  <XIcon width={14} height={14} className="ml-2" />
                </button>
              ))}
            </div>
          )
        ) : (
          <p className="text-slate-400">Select...</p>
        )}
        <div>
          {open ? (
            <ChevronUpIcon className="ml-2 h-4 w-4 opacity-50" />
          ) : (
            <ChevronDownIcon className="ml-2 h-4 w-4 opacity-50" />
          )}
        </div>
      </div>
      <div className="relative mt-2 h-full">
        {open && (
          <div className="animate-in bg-popover absolute top-0 z-10 max-h-52 w-full overflow-auto rounded-md border bg-white outline-none">
            <CommandList>
              <CommandEmpty>No result found.</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((o) => (
                  <CommandItem
                    key={o.value}
                    onSelect={() => handleSelect(o.value)}
                    className="cursor-pointer">
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </div>
        )}
      </div>
    </Command>
  );
};
