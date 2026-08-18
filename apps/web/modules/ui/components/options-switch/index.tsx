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
  /**
   * Id of the element naming this group. A plain `<label htmlFor>` cannot name the switch — the
   * container is a `fieldset`, which is not a labelable element, so the association is silently
   * dropped. Point this at the label instead.
   */
  "aria-labelledby"?: string;
}

export const OptionsSwitch = ({
  options: elementTypes,
  currentOption,
  handleOptionChange,
  "aria-labelledby": ariaLabelledBy,
}: OptionsSwitchProps) => {
  const [highlightStyle, setHighlightStyle] = useState({});
  const containerRef = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    const updateHighlight = () => {
      if (containerRef.current) {
        const activeElement = containerRef.current.querySelector(`[data-value="${currentOption}"]`);
        if (activeElement) {
          const { offsetLeft, offsetWidth } = activeElement as HTMLElement;
          setHighlightStyle({
            left: `${offsetLeft}px`,
            width: `${offsetWidth}px`,
          });
        } else {
          // Hide highlight if no matching element found
          setHighlightStyle({ opacity: 0 });
        }
      }
    };
    // Initial call
    updateHighlight();

    // Listen to resize
    window.addEventListener("resize", updateHighlight);
    return () => window.removeEventListener("resize", updateHighlight);
  }, [currentOption]);

  return (
    // A fieldset rather than a div with role="group": it carries the grouping semantics natively, so
    // the label referenced by aria-labelledby names the whole switch. `min-w-0` undoes the browser's
    // default `min-width: min-content` on fieldset, which would otherwise stop it shrinking in a
    // flex parent.
    <fieldset
      ref={containerRef}
      aria-labelledby={ariaLabelledBy}
      className="relative flex w-full min-w-0 items-center justify-between rounded-md border bg-white p-1">
      <div
        className="absolute top-1 bottom-1 rounded-md bg-slate-100 transition-all duration-300 ease-in-out"
        style={highlightStyle}
      />
      {elementTypes.map((type) => (
        <button
          type="button"
          key={type.value}
          data-value={type.value}
          // The selected option is otherwise conveyed only by the sliding highlight, which is a
          // decorative div — nothing tells a screen reader which one is active.
          aria-pressed={currentOption === type.value}
          onClick={(e) => {
            e.preventDefault();
            !type.disabled && handleOptionChange(type.value);
          }}
          className={`relative z-10 grow rounded-md p-2 text-center transition-colors duration-200 ${
            type.disabled
              ? "cursor-not-allowed opacity-50"
              : currentOption === type.value
                ? ""
                : "cursor-pointer hover:bg-slate-50"
          }`}>
          <div className="flex items-center justify-center gap-x-2">
            <span className="text-sm text-slate-900">{type.label}</span>
            {type.icon && <div className="size-4 text-slate-600 hover:text-slate-800">{type.icon}</div>}
          </div>
        </button>
      ))}
    </fieldset>
  );
};
