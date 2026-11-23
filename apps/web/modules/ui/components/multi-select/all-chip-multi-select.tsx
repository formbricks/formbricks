"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import { Badge } from "@/modules/ui/components/multi-select/badge";
import { cn } from "@/modules/ui/lib/utils";

export interface AllChipOption {
  value: string;
  label: string;
  /** An option that may stay chosen but not be picked again. */
  disabled?: boolean;
}

interface AllChipMultiSelectProps {
  options: AllChipOption[];
  /** The chosen values. Empty means "all" — no limit. */
  value: string[];
  onChange: (value: string[]) => void;
  /** The chip shown while nothing is chosen, e.g. "All teams" or "All dashboards". */
  allLabel: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Names the control for assistive technology. */
  ariaLabel?: string;
}

/**
 * A MultiSelect whose empty state is one removable "All …" chip (ENG-7252). Removing that chip opens the
 * picker; picked items are ordinary chips. Leaving the control with nothing picked shows "All …" again,
 * so an empty choice always reads as "no limit". Disabled, it shows the chips without their ×.
 */
export function AllChipMultiSelect({
  options,
  value,
  onChange,
  allLabel,
  disabled = false,
  placeholder,
  className,
  ariaLabel,
}: Readonly<AllChipMultiSelectProps>) {
  const { t } = useTranslation();
  // True between removing the "All" chip and leaving the control: the picker shows while nothing is picked.
  const [isPicking, setIsPicking] = useState(false);
  const labelOf = (selected: string) =>
    options.find((option) => option.value === selected)?.label ?? selected;
  const chipClass = "max-w-full rounded-md";

  if (disabled) {
    return (
      <div
        aria-label={ariaLabel}
        className={cn("flex flex-wrap gap-1 rounded-md border border-slate-200 px-3 py-2", className)}>
        {value.length === 0 ? (
          <Badge className={chipClass}>{allLabel}</Badge>
        ) : (
          value.map((selected) => (
            <Badge key={selected} className={chipClass}>
              <span className="truncate">{labelOf(selected)}</span>
            </Badge>
          ))
        )}
      </div>
    );
  }

  if (value.length === 0 && !isPicking) {
    return (
      <div
        aria-label={ariaLabel}
        className={cn("flex flex-wrap gap-1 rounded-md border border-slate-200 px-3 py-2", className)}>
        <Badge className={chipClass}>
          <span className="truncate">{allLabel}</span>
          <button
            type="button"
            aria-label={t("common.remove_item", { item: allLabel })}
            className="ml-1 rounded-full outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={() => setIsPicking(true)}>
            <X className="size-3" />
          </button>
        </Badge>
      </div>
    );
  }

  return (
    <div
      aria-label={ariaLabel}
      className={className}
      onBlur={(event) => {
        // Leaving the control with nothing picked means "all" again.
        if (!event.currentTarget.contains(event.relatedTarget)) setIsPicking(false);
      }}>
      <MultiSelect
        options={options}
        value={value}
        onChange={(next) => onChange(next)}
        placeholder={placeholder}
        focusOnMount={isPicking && value.length === 0}
      />
    </div>
  );
}
