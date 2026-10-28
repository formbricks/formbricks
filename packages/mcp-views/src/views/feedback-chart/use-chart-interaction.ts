import { type KeyboardEvent, useCallback, useState } from "react";
import type { Selection } from "./tooltip";

interface Options {
  categoryCount: number;
  seriesCount: number;
  /** Which arrow keys step through categories; the other pair steps through series. */
  categoryKeys: "horizontal" | "vertical";
  onSelect: (selection: Selection | null) => void;
}

const clamp = (value: number, max: number): number => Math.min(Math.max(value, 0), Math.max(0, max));

/**
 * The part of a chart that is not drawing: which mark is active (the pointer or the keyboard is on it)
 * and the keyboard model. The chart is one tab stop; arrows move the active mark, Enter selects it,
 * Escape clears. Selecting never sends anything: it only shows the "break this down" button.
 */
export const useChartInteraction = ({ categoryCount, seriesCount, categoryKeys, onSelect }: Options) => {
  const [active, setActive] = useState<Selection | null>(null);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<SVGSVGElement>) => {
      if (categoryCount === 0) return;
      const [previous, next, seriesPrevious, seriesNext] =
        categoryKeys === "horizontal"
          ? ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]
          : ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      const current = active ?? { category: 0, series: 0 };
      let target: Selection | null | undefined;
      switch (event.key) {
        case previous:
          target = { ...current, category: clamp(current.category - 1, categoryCount - 1) };
          break;
        case next:
          target = { ...current, category: clamp(current.category + 1, categoryCount - 1) };
          break;
        case seriesPrevious:
          target = { ...current, series: clamp(current.series - 1, seriesCount - 1) };
          break;
        case seriesNext:
          target = { ...current, series: clamp(current.series + 1, seriesCount - 1) };
          break;
        case "Home":
          target = { ...current, category: 0 };
          break;
        case "End":
          target = { ...current, category: categoryCount - 1 };
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          onSelect(current);
          return;
        case "Escape":
          setActive(null);
          onSelect(null);
          return;
        default:
          return;
      }
      event.preventDefault();
      setActive(target);
    },
    [active, categoryCount, categoryKeys, onSelect, seriesCount]
  );

  const onFocus = useCallback(
    (event: React.FocusEvent<SVGSVGElement>) => {
      // Only a keyboard arrival opens the first tooltip; a click that happens to focus the chart does not.
      if (event.currentTarget.matches(":focus-visible")) {
        setActive((current) => current ?? { category: 0, series: 0 });
      }
    },
    [setActive]
  );

  const onBlur = useCallback(() => setActive(null), []);

  return { active, setActive, handlers: { onKeyDown, onFocus, onBlur } };
};
