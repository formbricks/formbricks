"use client";

import { LockIcon, XIcon } from "lucide-react";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

type TFilterChipProps = {
  readonly label: string;
  readonly value: string;
  readonly accessibleName: string;
  /** Without it the chip has no `×`: a filter that holds nothing yet has nothing to remove. */
  readonly onRemove?: () => void;
  readonly disabled?: boolean;
  /**
   * `sm` sits in a table's filter row; `md` matches the height of the inputs and selects beside it, as in
   * a dashboard's filter bar.
   */
  readonly size?: "sm" | "md";
  /**
   * Set for everyone and not edited here: the chip shows a lock, says why on hover, and its body opens
   * nothing. `onRemove` may still be given, to whoever may take it off.
   */
  readonly lockedHint?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value">;

/**
 * One active filter (ENG-3538): `Label:` then the values as a bold inner pill, then `×`. The body
 * reopens the filter; `×` removes only this one. Both are real buttons, so Tab reaches each.
 */
export const FilterChip = forwardRef<HTMLButtonElement, TFilterChipProps>(
  (
    { label, value, accessibleName, onRemove, disabled, size = "sm", lockedHint, className, ...bodyProps },
    ref
  ) => {
    const { t } = useTranslation();
    const body = (
      <>
        <span className="shrink-0 whitespace-nowrap">{label}</span>
        {value && (
          <span className="max-w-56 truncate rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-800">
            {value}
          </span>
        )}
      </>
    );
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300",
          lockedHint && "border-slate-300 bg-slate-50",
          size === "sm" ? "h-7 text-xs" : "h-10 text-sm",
          disabled && "opacity-60",
          className
        )}>
        {lockedHint ? (
          <span
            role="group"
            title={lockedHint}
            aria-label={t("common.table_toolbar.locked_filter", { filter: accessibleName })}
            className={cn(
              "flex h-full min-w-0 items-center gap-1.5 py-0.5",
              onRemove ? "pr-1" : "pr-2",
              size === "sm" ? "pl-2" : "pl-3"
            )}>
            <LockIcon className="size-3.5 shrink-0 text-slate-500" aria-hidden="true" />
            {body}
          </span>
        ) : (
          <button
            ref={ref}
            type="button"
            disabled={disabled}
            aria-label={t("common.table_toolbar.edit_filter", { filter: accessibleName })}
            title={value ? `${label} ${value}` : label}
            className={cn(
              "focus-visible:ring-ring flex h-full min-w-0 items-center gap-1.5 py-0.5 focus-visible:ring-1 focus-visible:outline-hidden",
              onRemove ? "rounded-l-md pr-1" : "rounded-md pr-2",
              size === "sm" ? "pl-2" : "pl-3"
            )}
            {...bodyProps}>
            {body}
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            disabled={disabled}
            onClick={onRemove}
            aria-label={
              lockedHint
                ? t("common.table_toolbar.unlock_filter", { filter: accessibleName })
                : t("common.table_toolbar.remove_filter", { filter: accessibleName })
            }
            className={cn(
              "focus-visible:ring-ring flex h-full items-center rounded-r-md text-slate-500 hover:text-slate-900 focus-visible:ring-1 focus-visible:outline-hidden",
              size === "sm" ? "px-1.5" : "px-2"
            )}>
            <XIcon className="size-3.5" />
          </button>
        )}
      </span>
    );
  }
);
FilterChip.displayName = "FilterChip";
