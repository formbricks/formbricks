"use client";

import { AlertCircleIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { ErrorList, type TErrorSummaryItem } from "@/modules/ui/components/error-summary/error-list";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";

/** How long the pointer may be away from the badge and the list before the list closes. */
const CLOSE_DELAY_MS = 200;

interface EditorErrorBadgeProps {
  /** One entry per kind of error, already merged for repeats; each goes to its place when selected. */
  readonly items: readonly TErrorSummaryItem[];
  /** How many errors there are, before repeats are merged into one entry. */
  readonly errorCount: number;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * The red "14 errors found" badge in the menu bar and the list it opens: on hover, on click, and when a
 * disabled Activate is clicked. The list is the same cards the inline errors come from, grouped by tab.
 */
export const EditorErrorBadge = ({ items, errorCount, open, onOpenChange }: EditorErrorBadgeProps) => {
  const { t } = useTranslation();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set when the list closes because an error was picked: focus then belongs to that error's field.
  const pickedError = useRef(false);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => onOpenChange(false), CLOSE_DELAY_MS);
  };
  const openNow = () => {
    cancelClose();
    onOpenChange(true);
  };
  useEffect(() => cancelClose, []);

  const label = t("workspace.surveys.edit.issue_error_count", { count: errorCount });

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {/* The badge appears when a publish is refused: say so, as the focus-moving summary bar used to. */}
      <output aria-live="polite" className="sr-only">
        {label}
      </output>
      <PopoverTrigger asChild>
        <button
          type="button"
          // Hover opens it. A click keeps it open for a mouse (it is already open from the hover) and toggles
          // it from the keyboard (detail 0); preventDefault stops Radix's own toggle from closing it.
          onClick={(event) => {
            event.preventDefault();
            onOpenChange(event.detail === 0 ? !open : true);
          }}
          onPointerEnter={(event) => event.pointerType === "mouse" && openNow()}
          onPointerLeave={(event) => event.pointerType === "mouse" && scheduleClose()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-error-foreground",
            "hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden"
          )}>
          <AlertCircleIcon aria-hidden="true" className="size-3.5 shrink-0 text-error" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        // The list opens on hover, so it must not take focus from the page and close on the first keystroke.
        onOpenAutoFocus={(event) => event.preventDefault()}
        // Radix hands focus back to the badge on close; after picking an error it would take it from the field.
        onCloseAutoFocus={(event) => {
          if (!pickedError.current) return;
          pickedError.current = false;
          event.preventDefault();
        }}
        onPointerEnter={cancelClose}
        onPointerLeave={scheduleClose}
        className="max-h-[70vh] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto bg-slate-50 p-3">
        <h2 className="mb-2 px-1 text-sm font-semibold text-slate-900">{label}</h2>
        <ErrorList
          className="gap-2"
          items={items.map((item) => ({
            ...item,
            onSelect: () => {
              pickedError.current = true;
              onOpenChange(false);
              item.onSelect();
            },
          }))}
        />
      </PopoverContent>
    </Popover>
  );
};
