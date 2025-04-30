import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
import { useEffect, useState } from "react";

type Option = {
  label: string;
  icon?: any;
  value: string | number;
  disabled?: boolean;
};

type DropdownProps = {
  options: Option[];
  disabled?: boolean;
  defaultValue: string | number;
  onSelect: (option: Option) => any;
};

export const Dropdown = ({ options, defaultValue, onSelect, disabled = false }: DropdownProps) => {
  // [UseTusk]

  const [selectedOption, setSelectedOption] = useState<Option>(
    options.filter((option) => option.value === defaultValue)[0] || options[0]
  );

  useEffect(() => {
    setSelectedOption(options.filter((option) => option.value === defaultValue)[0] || options[0]);
  }, [defaultValue, options]);

  const handleSelect = (option) => {
    setSelectedOption(option);
    onSelect(option);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300">
          <span className="flex flex-1">
            {selectedOption.icon && <selectedOption.icon className="mr-3 h-5 w-5" />}
            <span>{selectedOption ? selectedOption.label : "Select an option"}</span>
          </span>
          <span className="flex h-full items-center border-l pl-3">
            <ChevronDownIcon className="h-4 w-4 text-slate-500" />
          </span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[220px] rounded-md bg-white text-sm text-slate-800 shadow-md"
          align="start">
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              className="flex cursor-pointer items-center p-3 hover:bg-slate-100 hover:outline-none data-[disabled]:cursor-default data-[disabled]:opacity-50"
              disabled={disabled || option.disabled}
              onSelect={() => handleSelect(option)}>
              {option.icon && <option.icon className="mr-3 h-5 w-5" />}
              {option.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
