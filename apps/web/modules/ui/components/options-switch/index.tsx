import React, { useEffect, useRef, useState } from "react";

interface TOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean; // Add disabled property to individual options
}

interface OptionsSwitchProps {
  options: TOption[];
  currentOption: string | undefined;
  handleOptionChange: (value: string) => void;
}

export const OptionsSwitch = ({
  options: questionTypes,
  currentOption,
  handleOptionChange,
}: OptionsSwitchProps) => {
  const [highlightStyle, setHighlightStyle] = useState({});
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (containerRef.current) {
      const activeElement = containerRef.current.querySelector(`[data-value="${currentOption}"]`);
      if (activeElement) {
        const { offsetLeft, offsetWidth } = activeElement as HTMLElement;
        setHighlightStyle({
          left: `${offsetLeft}px`,
          width: `${offsetWidth}px`,
        });
      }
    }
  }, [currentOption]);

  return (
    <div
      ref={containerRef}
      className="relative flex w-full items-center justify-between rounded-md border bg-white p-1">
      <div
        className="absolute bottom-1 top-1 rounded-md bg-slate-100 transition-all duration-300 ease-in-out"
        style={highlightStyle}
      />
      {questionTypes.map((type) => (
        <button
          key={type.value}
          data-value={type.value}
          onClick={() => !type.disabled && handleOptionChange(type.value)}
          className={`relative z-10 flex-grow rounded-md p-2 text-center transition-colors duration-200 ${
            type.disabled
              ? "cursor-not-allowed opacity-50"
              : currentOption === type.value
                ? ""
                : "cursor-pointer hover:bg-slate-50"
          }`}>
          <div className="flex items-center justify-center space-x-2">
            <span className="text-sm text-slate-900">{type.label}</span>
            {type.icon && <div className="h-4 w-4 text-slate-600 hover:text-slate-800">{type.icon}</div>}
          </div>
        </button>
      ))}
    </div>
  );
};
