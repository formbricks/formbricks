import React from "react";

interface TOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface OptionsSwitchProps {
  options: TOption[];
  currentOption: string | undefined;
  handleOptionChange: (value: string) => void;
  disabled?: boolean;
}

export const OptionsSwitch = ({
  options: questionTypes,
  currentOption,
  handleOptionChange,
  disabled = false,
}: OptionsSwitchProps) => {
  return (
    <div className="flex w-full items-center justify-between rounded-md border p-1">
      {questionTypes.map((type) => (
        <div
          key={type.value}
          onClick={() => !disabled && handleOptionChange(type.value)}
          className={`flex-grow cursor-pointer rounded-md bg-${
            (currentOption === undefined && type.value === "text") || currentOption === type.value
              ? "slate-100"
              : "white"
          } p-2 text-center ${disabled ? "cursor-not-allowed" : ""}`}>
          <div className="flex items-center justify-center space-x-2">
            <span className="text-sm text-slate-900">{type.label}</span>
            {type.icon ? (
              <div className="h-4 w-4 text-slate-600 hover:text-slate-800">{type.icon}</div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
};
