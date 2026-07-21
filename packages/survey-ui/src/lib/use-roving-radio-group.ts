import * as React from "react";

interface RovingRadioProps {
  tabIndex: number;
  ref: (el: HTMLInputElement | null) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
}

/**
 * Roving-tabindex keyboard model for a group of native radio inputs where
 * selecting an option has side effects (e.g. survey auto-progress submits the
 * card). Native radios select on arrow-key focus moves, which would make
 * browsing the options impossible for keyboard users; per the WAI-ARIA APG
 * radio-group guidance, selection is therefore decoupled from focus:
 *
 * - Tab enters the group at the selected option (or the first one).
 * - Arrow keys move focus WITHOUT selecting (wrapping, RTL-aware).
 * - Home/End jump to the first/last option.
 * - Space (native) or Enter selects the focused option.
 *
 * Spread the returned props onto every radio `<input>` of the group, in the
 * same order as `values`.
 */
export function useRovingRadioGroup({
  values,
  selectedValue,
  onSelect,
}: {
  /** Option values in visual/DOM order */
  values: string[];
  /** Currently selected option value, if any */
  selectedValue: string | undefined;
  /** Called when the user explicitly selects the focused option via Enter */
  onSelect: (value: string) => void;
}): {
  getRadioProps: (value: string) => RovingRadioProps;
} {
  const inputRefs = React.useRef<Map<string, HTMLInputElement>>(new Map());
  // The roving position while focus is inside the group; null = follow selection.
  const [focusedValue, setFocusedValue] = React.useState<string | null>(null);

  const rovingValue =
    focusedValue ?? (selectedValue && values.includes(selectedValue) ? selectedValue : values[0]);

  const focusValue = (value: string): void => {
    setFocusedValue(value);
    inputRefs.current.get(value)?.focus();
  };

  const handleKeyDown = (value: string) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    const index = values.indexOf(value);
    if (index === -1) return;

    // dir="auto" is resolved per element, so read the effective direction from the DOM.
    const isRtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const nextKey = isRtl ? "ArrowLeft" : "ArrowRight";
    const prevKey = isRtl ? "ArrowRight" : "ArrowLeft";

    switch (e.key) {
      case nextKey:
      case "ArrowDown":
        e.preventDefault();
        focusValue(values[(index + 1) % values.length]);
        break;
      case prevKey:
      case "ArrowUp":
        e.preventDefault();
        focusValue(values[(index - 1 + values.length) % values.length]);
        break;
      case "Home":
        e.preventDefault();
        focusValue(values[0]);
        break;
      case "End":
        e.preventDefault();
        focusValue(values[values.length - 1]);
        break;
      case "Enter":
        // Enter selects like Space; prevent implicit form submission so the
        // selection itself (and any auto-progress) is the only effect.
        e.preventDefault();
        onSelect(value);
        break;
      default:
      // Space keeps its native behavior: the browser checks the focused radio
      // and fires change, which is the explicit selection.
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>): void => {
    // Reset the roving position when focus leaves the group so Tab re-enters
    // at the selected option, matching native radio-group behavior.
    const next = e.relatedTarget;
    const leavingGroup = !next || ![...inputRefs.current.values()].includes(next as HTMLInputElement);
    if (leavingGroup) setFocusedValue(null);
  };

  const getRadioProps = (value: string): RovingRadioProps => ({
    tabIndex: value === rovingValue ? 0 : -1,
    ref: (el: HTMLInputElement | null) => {
      if (el) inputRefs.current.set(value, el);
      else inputRefs.current.delete(value);
    },
    onKeyDown: handleKeyDown(value),
    onFocus: () => {
      setFocusedValue(value);
    },
    onBlur: handleBlur,
  });

  return { getRadioProps };
}
