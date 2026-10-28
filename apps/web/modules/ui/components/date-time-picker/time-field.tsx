"use client";

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/modules/ui/components/input";
import {
  type TTimeParts,
  formatTimeText,
  getDayPeriodMarkers,
  getTimeTextState,
  parseTimeText,
} from "./lib/date-time";

interface TimeFieldProps {
  /** The committed value; its local time is what the field shows once typing has settled. */
  value: Date | null;
  locale?: string;
  /** Fires for every typed text that reads as a time, so the trigger follows along. */
  onTimeChange: (time: TTimeParts) => void;
}

// A time to show the person what the field takes, written the way their locale writes it.
const EXAMPLE_TIME = new Date(2000, 0, 1, 14, 30);

/**
 * The popover's time field: one text box that takes the time as typed ("23:59", "11:59 PM") and shows
 * it back in the app locale. A native time input would follow the browser's clock format instead of the
 * app's language, so the field names its format instead: an example in the app locale is its placeholder
 * and its hint. Text no typing can turn into a time is flagged as it is typed; a time left half-typed
 * ("9:3") is flagged when the field is left.
 */
export const TimeField = ({ value, locale, onTimeChange }: Readonly<TimeFieldProps>) => {
  const { t } = useTranslation();
  const id = useId();
  const hintId = `${id}-hint`;
  const example = formatTimeText(EXAMPLE_TIME, locale);
  // What is being typed. Null means "show the committed value", which is also how a settled entry is
  // normalised ("2pm" comes back as "2:00 PM").
  const [draft, setDraft] = useState<string | null>(null);
  const [isInvalid, setIsInvalid] = useState(false);

  const markers = getDayPeriodMarkers(locale);
  const read = (text: string) => parseTimeText(text, markers);

  const handleChange = (text: string) => {
    setDraft(text);
    setIsInvalid(getTimeTextState(text, markers) === "invalid");
    const time = read(text);
    if (time) onTimeChange(time);
  };

  // On blur and Enter. Text that isn't a time stays on screen with its error instead of vanishing.
  const settle = () => {
    if (draft === null) return;
    if (draft.trim() === "" || read(draft)) {
      setDraft(null);
      return;
    }
    setIsInvalid(true);
  };

  return (
    <div className="flex flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-600">
        {t("common.time")}
      </label>
      <Input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        className="h-9"
        value={draft ?? (value ? formatTimeText(value, locale) : "")}
        placeholder={example}
        isInvalid={isInvalid}
        aria-invalid={isInvalid || undefined}
        aria-describedby={hintId}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={settle}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          // Enter confirms the time; the popover stays open and nothing around it submits.
          event.preventDefault();
          settle();
        }}
      />
      {/* The format up front, and the error once the text can't be a time: the same words, in red. */}
      <p
        id={hintId}
        aria-live="polite"
        className={isInvalid ? "text-xs text-error" : "text-xs text-slate-500"}>
        {t("common.enter_a_time_like", { example })}
      </p>
    </div>
  );
};
