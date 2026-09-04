import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

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
}: Readonly<OptionsSwitchProps>) => {
  /**
   * Position and animation travel together in one state so they can only ever change in the same
   * commit: the pill animates when the *selection* changes and is placed outright otherwise. A
   * re-measure that finds the same geometry writes nothing at all — which matters because
   * ResizeObserver always delivers one callback the moment it starts observing, and that callback
   * would otherwise cancel the animation of the change that just set it up.
   */
  const [highlight, setHighlight] = useState<{
    left?: string;
    width?: string;
    opacity?: number;
    animated: boolean;
  }>({ animated: false });
  const containerRef = useRef<HTMLFieldSetElement>(null);
  const hasMeasuredRef = useRef(false);

  useEffect(() => {
    const measure = (animated: boolean) => {
      const container = containerRef.current;
      if (!container) return;

      const activeElement = container.querySelector<HTMLElement>(`[data-value="${currentOption}"]`);
      if (!activeElement) {
        // Hide highlight if no matching element found
        setHighlight({ opacity: 0, animated: false });
        return;
      }

      const left = `${activeElement.offsetLeft}px`;
      const width = `${activeElement.offsetWidth}px`;
      setHighlight((previous) =>
        previous.left === left && previous.width === width ? previous : { left, width, animated }
      );
    };

    // The first measurement is the mount: place the pill, never slide it in. Every dialog holding
    // one of these otherwise plays a slide across the options as it opens.
    measure(hasMeasuredRef.current);
    hasMeasuredRef.current = true;

    // The pill is positioned in pixels read from the DOM, so it is only correct until the switch's
    // own box changes — and `window.resize` misses every way that happens in practice: a dialog
    // still running its open animation, a sibling appearing beside the switch, a column gaining a
    // scrollbar, a webfont swapping in. Observing the element itself (and the active option, whose
    // width can change without the container's) re-measures on the frame it moves.
    const container = containerRef.current;
    const remeasure = () => measure(false);
    const observer = new ResizeObserver(remeasure);
    if (container) {
      observer.observe(container);
      const activeElement = container.querySelector(`[data-value="${currentOption}"]`);
      if (activeElement) observer.observe(activeElement);
    }

    window.addEventListener("resize", remeasure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", remeasure);
    };
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
        className={cn(
          "absolute top-1 bottom-1 rounded-md bg-slate-100",
          highlight.animated && "transition-all duration-300 ease-in-out"
        )}
        style={{ left: highlight.left, width: highlight.width, opacity: highlight.opacity }}
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
          // nowrap: these labels are short by design, and a two-word option breaking across lines
          // ("Vertical / bars", "Area / Chart") makes the whole switch grow a second row.
          className={`relative z-10 grow rounded-md p-2 text-center whitespace-nowrap transition-colors duration-200 ${
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
