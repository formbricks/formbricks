import React, { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";

type Option = {
  label: string;
  icon?: any;
  value: string | number;
  disabled?: boolean;
};

type DropdownProps = {
  options: Option[];
  defaultValue: string | number;
  onSelect: (option: Option) => any;
};

const DropdownMenu = ({ options, defaultValue, onSelect }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<Option>(
    options.filter((option) => option.value === defaultValue)[0] || options[0]
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSelect = (option) => {
    setSelectedOption(option);
    onSelect(option);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  return (
    <div ref={dropdownRef} className="relative z-50 inline-block w-full text-left">
      <button
        type="button"
        className="focus:border-brand flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300"
        onClick={() => setIsOpen(!isOpen)}>
        <span className="flex flex-1">
          {selectedOption.icon && <selectedOption.icon className="mr-3 h-5 w-5" />}
          <span>{selectedOption ? selectedOption.label : "Select an option"}</span>
        </span>
        <span className="flex h-full items-center border-l pl-3">
          <ChevronDownIcon className="h-4 w-4 text-gray-500" />
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-full origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
          <div className="relative py-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900  disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => handleSelect(option)}
                disabled={option.disabled}>
                {option.icon && <option.icon className="mr-3 h-5 w-5" />}
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;
