"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { type ClipboardEvent, type KeyboardEvent, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  CHIP_SEPARATOR_KEYS,
  type TAddChipsOptions,
  addChips,
  canOfferNewChip,
  filterChipSuggestions,
  hasChipSeparator,
  removeChipAt,
  splitChipInput,
} from "../lib/chips";

export type TTagsFieldProps = Readonly<{
  /** The chosen values, in order. */
  value: readonly string[];
  onChange?: (values: string[]) => void;
  /** Values already in use elsewhere (for a Member attribute: its other members' values), offered while typing. */
  suggestions?: readonly string[];
  placeholder?: string;
  disabled?: boolean;
  /** Shows the chips without the input or the × buttons: a member viewing their own values. */
  readOnly?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** Most chips the field holds. */
  maxValues?: number;
  /** Most characters in one chip. */
  maxLength?: number;
  className?: string;
}>;

type TOption = { kind: "suggestion"; value: string } | { kind: "new"; value: string };

/**
 * The tags combobox as a form field (ENG-7248): chips sit inside an input-looking box before the cursor.
 * Typing opens a listbox of matching suggestions and `+ Add "<text>"`; Enter, a comma or a semicolon adds
 * what is typed; pasting "Sweden; Norway" adds two; × or Backspace in the empty input removes a chip.
 * Duplicates are ignored, case-insensitively. Follows the ARIA combobox pattern with a listbox popup.
 *
 * Its value logic lives in `../lib/chips.ts`. The "Add tag" button variant for response tags is
 * `TagsCombobox` in `../index.tsx`, unchanged.
 */
export const TagsField = ({
  value,
  onChange,
  suggestions = [],
  placeholder,
  disabled = false,
  readOnly = false,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  maxValues,
  maxLength,
  className,
}: TTagsFieldProps) => {
  const { t } = useTranslation();
  const generatedId = useId();
  const inputId = id ?? `${generatedId}-input`;
  const listboxId = `${generatedId}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const limits: TAddChipsOptions = { maxValues, maxLength };
  const isFull = maxValues !== undefined && value.length >= maxValues;
  const interactive = !disabled && !readOnly;

  const visibleSuggestions = useMemo(
    () => filterChipSuggestions(suggestions, value, query, 8),
    [suggestions, value, query]
  );
  const options: TOption[] = useMemo(() => {
    const list: TOption[] = visibleSuggestions.map((suggestion) => ({
      kind: "suggestion",
      value: suggestion,
    }));
    if (canOfferNewChip(query, value, visibleSuggestions)) list.push({ kind: "new", value: query.trim() });
    return list;
  }, [visibleSuggestions, query, value]);
  const showList = interactive && isOpen && options.length > 0 && !isFull;
  const safeActiveIndex = Math.min(activeIndex, Math.max(options.length - 1, 0));

  const commit = (incoming: readonly string[]) => {
    const next = addChips(value, incoming, limits);
    if (next !== value) onChange?.(next);
    setQuery("");
    setActiveIndex(0);
  };

  const remove = (index: number) => {
    onChange?.(removeChipAt(value, index));
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (options.length === 0) return;
      event.preventDefault();
      setIsOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + step + options.length) % options.length);
      return;
    }
    if (event.key === "Enter") {
      // Enter never submits the surrounding form from inside the field.
      event.preventDefault();
      const option = showList ? options[safeActiveIndex] : undefined;
      commit(option ? [option.value] : splitChipInput(query));
      return;
    }
    if (CHIP_SEPARATOR_KEYS.has(event.key)) {
      event.preventDefault();
      commit(splitChipInput(query));
      return;
    }
    if (event.key === "Backspace" && query === "" && value.length > 0) {
      event.preventDefault();
      onChange?.(removeChipAt(value, value.length - 1));
      return;
    }
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (!hasChipSeparator(text)) return;
    event.preventDefault();
    commit(splitChipInput(`${query}${text}`));
  };

  const optionId = (index: number) => `${listboxId}-option-${index}`;

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm",
          interactive &&
            "cursor-text focus-within:border-slate-500 focus-within:ring-1 focus-within:ring-slate-400",
          disabled && "cursor-not-allowed opacity-50",
          readOnly && "border-slate-200 bg-slate-50"
        )}
        onClick={() => interactive && inputRef.current?.focus()}
        role="presentation">
        {value.length > 0 && (
          <ul className="contents" aria-label={t("common.tags_field.selected_values")}>
            {value.map((chip, index) => (
              <li
                key={chip}
                className="ph-no-capture inline-flex max-w-full items-center gap-1 rounded-md bg-slate-100 py-0.5 pr-1 pl-2 text-slate-800">
                <span className="truncate">{chip}</span>
                {interactive && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      remove(index);
                    }}
                    aria-label={t("common.tags_field.remove_value", { value: chip })}
                    className="rounded-sm p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none">
                    <XIcon className="size-3" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {readOnly ? (
          value.length === 0 && <span className="text-slate-400">—</span>
        ) : (
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={listboxId}
            aria-activedescendant={showList ? optionId(safeActiveIndex) : undefined}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            autoComplete="off"
            disabled={disabled || isFull}
            value={query}
            maxLength={maxLength}
            placeholder={
              value.length === 0 ? (placeholder ?? t("common.tags_field.add_value_placeholder")) : ""
            }
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
              setActiveIndex(0);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              // Whatever is typed when the field is left becomes a chip, so nothing typed is lost on Save.
              if (query.trim() !== "") commit(splitChipInput(query));
              setIsOpen(false);
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            className="h-7 min-w-24 flex-1 border-none bg-transparent p-0 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-hidden disabled:cursor-not-allowed"
          />
        )}
      </div>
      {!readOnly && (
        <ul
          id={listboxId}
          // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- the ARIA combobox popup: chips need a styled, positioned list that <datalist> and <select> cannot render
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            "absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white p-1 text-sm shadow-md",
            !showList && "hidden"
          )}>
          {showList &&
            options.map((option, index) => (
              <li
                key={`${option.kind}-${option.value}`}
                id={optionId(index)}
                // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- an item of the suggestion listbox above
                role="option"
                aria-selected={index === safeActiveIndex}
                // Mouse down, not click: the input's blur would otherwise commit the typed text first.
                onMouseDown={(event) => {
                  event.preventDefault();
                  commit([option.value]);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-slate-700",
                  index === safeActiveIndex && "bg-slate-100 text-slate-900"
                )}>
                {option.kind === "new" ? (
                  <>
                    <PlusIcon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {t("common.tags_field.add_new_value", { value: option.value })}
                    </span>
                  </>
                ) : (
                  <span className="ph-no-capture truncate">{option.value}</span>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
};
