"use client";

import { XIcon } from "lucide-react";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

type TFilterChipProps = {
  label: string;
  value: string;
  accessibleName: string;
  onRemove: () => void;
  disabled?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value">;

/**
 * One active filter (ENG-3538): `Label:` then the values as a bold inner pill, then `×`. The body
 * reopens the filter; `×` removes only this one. Both are real buttons, so Tab reaches each.
 */
export const FilterChip = forwardRef<HTMLButtonElement, TFilterChipProps>(
  ({ label, value, accessibleName, onRemove, disabled, className, ...bodyProps }, ref) => {
    const { t } = useTranslation();
    return (
      <span
        className={cn(
          "inline-flex h-7 max-w-full items-center rounded-md border border-slate-200 bg-white text-xs text-slate-700 transition-colors hover:border-slate-300",
          disabled && "opacity-60",
          className
        )}>
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          aria-label={t("common.table_toolbar.edit_filter", { filter: accessibleName })}
          title={value ? `${label} ${value}` : label}
          className="focus-visible:ring-ring flex min-w-0 items-center gap-1.5 rounded-l-md py-0.5 pr-1 pl-2 focus-visible:ring-1 focus-visible:outline-hidden"
          {...bodyProps}>
          <span className="shrink-0 whitespace-nowrap">{label}</span>
          {value && (
            <span className="max-w-56 truncate rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-800">
              {value}
            </span>
          )}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          aria-label={t("common.table_toolbar.remove_filter", { filter: accessibleName })}
          className="focus-visible:ring-ring flex h-full items-center rounded-r-md px-1.5 text-slate-500 hover:text-slate-900 focus-visible:ring-1 focus-visible:outline-hidden">
          <XIcon className="size-3.5" />
        </button>
      </span>
    );
  }
);
FilterChip.displayName = "FilterChip";
