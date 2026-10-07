"use client";

import {
  type ChangeEvent,
  type KeyboardEvent,
  type Ref,
  type UIEvent,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/cn";
import {
  type TCodeEdit,
  type TCodeLineMark,
  type TCssSuggestionContext,
  applyCodeEdit,
  countLines,
  getCaretPosition,
  getCssSuggestionEdit,
  getCssSuggestions,
  getSoftTabEdit,
} from "./lib/code-field";

// Matches `text-xs leading-5` and `py-2` below: every line is 20px tall, starting 8px down.
const LINE_HEIGHT_PX = 20;
const PADDING_TOP_PX = 8;
const PADDING_LEFT_PX = 12;
const SUGGESTION_LIST_WIDTH_PX = 288;

export interface TCssCodeFieldHandle {
  /** Replaces the whole text as if typed, so the browser's undo can bring the old text back. */
  replaceAll: (text: string) => void;
}

interface CssCodeFieldProps {
  id: string;
  value: string;
  /** Absent for a read-only field. */
  onChange?: (value: string) => void;
  marks?: ReadonlyMap<number, TCodeLineMark>;
  invalid?: boolean;
  placeholder?: string;
  rows: number;
  resizable?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
  /** How to leave the field by keyboard; its `id` belongs in `aria-describedby`. */
  keyboardHint?: { id: string; text: string };
  handleRef?: Ref<TCssCodeFieldHandle>;
}

interface TOpenSuggestions extends TCssSuggestionContext {
  caret: number;
  active: number;
  top: number;
  left: number;
}

/**
 * The Custom CSS field (ENG-3723): a monospace textarea with a line-number gutter that marks lines
 * with an error in red and lines with a removed rule in amber. Tab indents by two spaces; Escape, then
 * Tab, leaves the field. Typing an attribute selector or a `--fb-` variable offers the survey's styling
 * hooks, states and theme variables at the caret.
 */
export const CssCodeField = ({
  id,
  value,
  onChange,
  marks,
  invalid = false,
  placeholder,
  rows,
  resizable = true,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  keyboardHint,
  handleRef,
}: Readonly<CssCodeFieldProps>) => {
  const listboxId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const bandsRef = useRef<HTMLDivElement>(null);
  const charRef = useRef<HTMLSpanElement>(null);
  const pendingSelection = useRef<[number, number] | null>(null);
  // Set by Escape so the next Tab leaves the field instead of indenting.
  const releaseTab = useRef(false);
  // An edit the field applies itself (indent, suggestion, upload) offers no suggestions.
  const isApplyingEdit = useRef(false);
  const [suggestions, setSuggestions] = useState<TOpenSuggestions | null>(null);
  const isEditable = onChange !== undefined;
  const markEntries = [...(marks ?? new Map<number, TCodeLineMark>())];
  const lineCount = countLines(value);

  useLayoutEffect(() => {
    const selection = pendingSelection.current;
    if (!selection || !textareaRef.current) return;
    pendingSelection.current = null;
    textareaRef.current.setSelectionRange(selection[0], selection[1]);
  }, [value]);

  const applyEdit = (edit: TCodeEdit) => {
    const textarea = textareaRef.current;
    if (!textarea || !onChange) return;
    setSuggestions(null);
    textarea.focus();
    textarea.setSelectionRange(edit.from, edit.to);
    // Applied as typed text so the change lands on the browser's undo stack, which a new `value`
    // would wipe. `execCommand` is the only way to do that; where it is missing, the edit is still
    // applied, just without undo.
    isApplyingEdit.current = true;
    const typed =
      edit.insert === ""
        ? document.execCommand("delete")
        : document.execCommand("insertText", false, edit.insert);
    isApplyingEdit.current = false;
    if (typed) {
      textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd);
      return;
    }
    pendingSelection.current = [edit.selectionStart, edit.selectionEnd];
    onChange(applyCodeEdit(textarea.value, edit));
  };

  useImperativeHandle(handleRef, () => ({
    replaceAll: (text: string) =>
      applyEdit({
        from: 0,
        to: textareaRef.current?.value.length ?? 0,
        insert: text,
        selectionStart: text.length,
        selectionEnd: text.length,
      }),
  }));

  const openSuggestions = (text: string, caret: number) => {
    const textarea = textareaRef.current;
    const context = getCssSuggestions(text, caret);
    if (!context || !textarea) {
      setSuggestions(null);
      return;
    }
    const { line, column } = getCaretPosition(text, context.from);
    const charWidth = charRef.current ? charRef.current.getBoundingClientRect().width / 10 : 7.2;
    const left = PADDING_LEFT_PX + column * charWidth - textarea.scrollLeft;
    setSuggestions({
      ...context,
      caret,
      active: 0,
      top: PADDING_TOP_PX + (line + 1) * LINE_HEIGHT_PX - textarea.scrollTop,
      left: Math.max(0, Math.min(left, textarea.clientWidth - SUGGESTION_LIST_WIDTH_PX)),
    });
  };

  const acceptSuggestion = (index: number) => {
    if (!suggestions) return;
    applyEdit(getCssSuggestionEdit(value, suggestions.caret, suggestions, suggestions.suggestions[index]));
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    releaseTab.current = false;
    onChange?.(event.target.value);
    const { selectionStart, selectionEnd } = event.target;
    const isTyping = !isApplyingEdit.current && (event.nativeEvent as InputEvent).inputType === "insertText";
    if (isTyping && selectionStart === selectionEnd) openSuggestions(event.target.value, selectionStart);
    else setSuggestions(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions) {
      const count = suggestions.suggestions.length;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setSuggestions({ ...suggestions, active: (suggestions.active + step + count) % count });
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        acceptSuggestion(suggestions.active);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setSuggestions(null);
        return;
      }
      setSuggestions(null);
    }

    if (event.key === "Escape") {
      releaseTab.current = true;
      return;
    }
    if (event.key === "Tab" && isEditable && !event.altKey && !event.ctrlKey && !event.metaKey) {
      if (releaseTab.current) {
        releaseTab.current = false;
        return;
      }
      event.preventDefault();
      const { selectionStart, selectionEnd } = event.currentTarget;
      applyEdit(getSoftTabEdit(value, selectionStart, selectionEnd, event.shiftKey));
      return;
    }
    releaseTab.current = false;
  };

  const handleScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    // Moved by hand rather than through state, so scrolling a long stylesheet re-renders nothing.
    const offset = `translateY(${-event.currentTarget.scrollTop}px)`;
    if (gutterRef.current) gutterRef.current.style.transform = offset;
    if (bandsRef.current) bandsRef.current.style.transform = offset;
    setSuggestions(null);
  };

  const lineTop = (line: number) => PADDING_TOP_PX + (line - 1) * LINE_HEIGHT_PX;
  const activeOptionId = suggestions ? `${listboxId}-${suggestions.active}` : undefined;

  return (
    <div
      className={cn(
        "group/code relative flex rounded-md border font-mono text-xs leading-5",
        isEditable ? "bg-white" : "bg-slate-50",
        invalid ? "border-red-500" : "border-slate-300",
        "focus-within:ring-2 focus-within:ring-slate-400 focus-within:ring-offset-1"
      )}>
      <div
        aria-hidden
        className="relative shrink-0 overflow-hidden rounded-l-md border-r border-slate-200 bg-slate-50 select-none"
        style={{ width: `${String(lineCount).length + 2.5}ch` }}>
        {/* Out of the flow, so the gutter takes the field's height instead of setting it. */}
        <div ref={gutterRef} className="absolute inset-x-0 top-0">
          <pre className="m-0 py-2 pr-2 text-right font-mono text-slate-400">
            {Array.from({ length: lineCount }, (_, index) => index + 1).join("\n")}
          </pre>
          {markEntries.map(([line, mark]) => (
            <span
              key={line}
              className={cn(
                "absolute inset-x-0 h-5 pr-2 text-right",
                mark === "error"
                  ? "bg-red-100 font-bold text-red-700"
                  : "bg-amber-100 font-semibold text-amber-700"
              )}
              style={{ top: lineTop(line) }}>
              {line}
            </span>
          ))}
        </div>
      </div>

      <div className="relative min-w-0 flex-1">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-r-md">
          <div ref={bandsRef} className="relative">
            {markEntries.map(([line, mark]) => (
              <div
                key={line}
                className={cn("absolute inset-x-0 h-5", mark === "error" ? "bg-red-50" : "bg-amber-50")}
                style={{ top: lineTop(line) }}
              />
            ))}
          </div>
        </div>
        <span ref={charRef} aria-hidden className="invisible absolute">
          0000000000
        </span>
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onBlur={() => setSuggestions(null)}
          onClick={() => setSuggestions(null)}
          readOnly={!isEditable}
          rows={rows}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={invalid}
          aria-describedby={ariaDescribedBy}
          aria-autocomplete={isEditable ? "list" : undefined}
          aria-controls={suggestions ? listboxId : undefined}
          aria-activedescendant={activeOptionId}
          // Sizes are restated: the forms plugin's textarea defaults would put the text off the gutter's lines.
          className={cn(
            "relative block w-full rounded-r-md border-0 bg-transparent px-3 py-2 font-mono text-xs leading-5 whitespace-pre [tab-size:2] text-slate-800 shadow-none outline-none placeholder:text-slate-400 focus:ring-0 focus:outline-none",
            resizable ? "min-h-24 resize-y" : "resize-none",
            !isEditable && "cursor-default text-slate-600"
          )}
        />
        {isEditable && keyboardHint && (
          // Read with the field, shown only while it has focus: Tab indents, so this says how to leave.
          <p
            id={keyboardHint.id}
            className="pointer-events-none absolute right-5 bottom-1.5 rounded bg-white/90 px-1.5 font-sans text-[11px] leading-4 text-slate-500 opacity-0 transition-opacity group-focus-within/code:opacity-100">
            {keyboardHint.text}
          </p>
        )}
        {suggestions && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-20 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
            style={{ top: suggestions.top, left: suggestions.left, width: SUGGESTION_LIST_WIDTH_PX }}>
            {suggestions.suggestions.map((suggestion, index) => (
              <li
                key={suggestion}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === suggestions.active}
                ref={(element) => {
                  if (index === suggestions.active) element?.scrollIntoView({ block: "nearest" });
                }}
                // Keeps focus in the field, so typing goes on after a click.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => acceptSuggestion(index)}
                className="cursor-pointer truncate px-3 py-1 text-slate-700 aria-selected:bg-slate-100 aria-selected:text-slate-900">
                {suggestion}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
