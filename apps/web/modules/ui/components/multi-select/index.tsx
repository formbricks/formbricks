"use client";

import { Command as CommandPrimitive } from "cmdk";
import { X } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import { Command, CommandGroup, CommandItem, CommandList } from "@/modules/ui/components/command";
import { Badge } from "@/modules/ui/components/multi-select/badge";
import { cn } from "@/modules/ui/lib/utils";

interface TOption<T> {
  value: T;
  label: string;
  /** Optional secondary line shown under the label in the dropdown (e.g. a field description). */
  description?: string;
  /** Optional section heading. Consecutive options with the same group render under one header;
   * order the options array to control section order. */
  group?: string;
  /** Optional icon shown in a box beside the section heading (take from the first option in a group). */
  groupIcon?: React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface MultiSelectProps<T extends string, K extends TOption<T>["value"][]> {
  options: TOption<T>[];
  value?: K;
  onChange?: (selected: K) => void;
  disabled?: boolean;
  placeholder?: string;
  containerClassName?: string;
}

export function MultiSelect<T extends string, K extends TOption<T>["value"][]>(
  props: Readonly<MultiSelectProps<T, K>>
) {
  const { options, value, onChange, disabled = false, placeholder, containerClassName } = props;

  const inputRef = React.useRef<HTMLInputElement>(null);

  const [selected, setSelected] = React.useState<TOption<T>[]>(() => {
    if (value) {
      return value.map((val) => options.find((o) => o.value === val)).filter((o): o is TOption<T> => !!o);
    }
    return [];
  });

  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [position, setPosition] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);

  // Track if changes are user-initiated (not from value prop)
  const isUserInitiatedRef = React.useRef(false);

  React.useEffect(() => {
    if (value) {
      const newSelected = value
        .map((val) => options.find((o) => o.value === val))
        .filter((o): o is TOption<T> => !!o);
      // Only update if different (avoid unnecessary updates)
      const currentValues = selected.map((s) => s.value);
      const newValues = newSelected.map((s) => s.value);
      if (
        currentValues.length !== newValues.length ||
        currentValues.some((val, idx) => val !== newValues[idx])
      ) {
        isUserInitiatedRef.current = false; // Mark as prop-initiated
        setSelected(newSelected);
      }
    }
  }, [value, options]);

  // Sync user-initiated selected changes to parent via onChange (deferred to avoid render issues)
  const prevSelectedRef = React.useRef(selected);
  React.useEffect(() => {
    // Only call onChange if change was user-initiated and selected actually changed
    if (isUserInitiatedRef.current && prevSelectedRef.current !== selected) {
      const selectedValues = selected.map((s) => s.value) as K;
      const prevValues = prevSelectedRef.current.map((s) => s.value) as K;
      // Check if values actually changed
      if (
        selectedValues.length !== prevValues.length ||
        selectedValues.some((val, idx) => val !== prevValues[idx])
      ) {
        // Use queueMicrotask to defer the onChange call after render
        queueMicrotask(() => {
          onChange?.(selectedValues);
        });
      }
      prevSelectedRef.current = selected;
      isUserInitiatedRef.current = false; // Reset flag
    } else if (!isUserInitiatedRef.current) {
      // Update ref even if not user-initiated to track state
      prevSelectedRef.current = selected;
    }
  }, [selected, onChange]);

  const handleUnselect = React.useCallback(
    (option: TOption<T>) => {
      if (disabled) return;
      isUserInitiatedRef.current = true; // Mark as user-initiated
      setSelected((prev) => prev.filter((s) => s.value !== option.value));
    },
    [disabled]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const input = inputRef.current;
      if (!input || disabled) return;

      if ((e.key === "Delete" || e.key === "Backspace") && input.value === "") {
        isUserInitiatedRef.current = true; // Mark as user-initiated
        setSelected((prev) => {
          const newSelected = [...prev];
          newSelected.pop();
          return newSelected;
        });
      }

      if (e.key === "Escape") {
        input.blur();
      }
    },
    [onChange, disabled]
  );

  const selectableOptions = React.useMemo(() => {
    return options
      .filter((o) => !selected.some((s) => s.value === o.value))
      .filter((o) => {
        if (!inputValue) return true;
        const needle = inputValue.toLowerCase();
        // Match label, group, and description so e.g. "emotion", "count", or a word from the
        // description all surface the option.
        return [o.label, o.group, o.description].some((field) => field?.toLowerCase().includes(needle));
      });
  }, [options, selected, inputValue]);

  // Cluster consecutive options that share a `group` into labelled sections, preserving the caller's
  // ordering. Options without a group form a single unlabelled section. Because empty groups are
  // never created, filtering hides section headers that have no matches.
  const optionGroups = React.useMemo(() => {
    const groups: { key: string; label?: string; icon?: React.ReactNode; options: TOption<T>[] }[] = [];
    for (const option of selectableOptions) {
      const last = groups[groups.length - 1];
      if (last && last.label === option.group) {
        last.options.push(option);
      } else {
        groups.push({
          key: option.group ?? "__ungrouped__",
          label: option.group,
          icon: option.groupIcon,
          options: [option],
        });
      }
    }
    return groups;
  }, [selectableOptions]);

  // Calculate position for dropdown when opening
  React.useEffect(() => {
    if (!open || !containerRef.current) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  React.useEffect(() => {
    if (!containerRef.current) return;

    // In modal contexts (Radix dialog), rendering inside body can make dropdown non-interactive.
    const dialogContent = containerRef.current.closest("[role='dialog']");
    setPortalContainer((dialogContent as HTMLElement) ?? document.body);
  }, []);

  return (
    <Command
      onKeyDown={handleKeyDown}
      // We filter options ourselves via `selectableOptions` (keyed off `inputValue`). cmdk's built-in
      // filter double-filters the already-pruned list and goes stale on backspace — options removed by
      // our filter unmount, and when they re-mount cmdk doesn't re-include them until the next keystroke,
      // so search only appeared to react to added letters. Disabling it makes our memo the sole filter.
      shouldFilter={false}
      className={`relative overflow-visible bg-white ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
      <div
        ref={containerRef}
        className={cn(
          `border-input ring-offset-background group rounded-md border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-offset-2`,
          disabled ? "pointer-events-none" : "focus-within:ring-ring",
          containerClassName ?? ""
        )}>
        <div className="flex flex-wrap gap-1">
          {selected.map((option) => (
            <Badge
              key={option.value}
              className="max-w-full rounded-md"
              title={option.description ?? option.label}>
              {option.icon ? (
                <span className="mr-1 inline-flex shrink-0 items-center">{option.icon}</span>
              ) : null}
              <span className="truncate">{option.label}</span>
              <button
                type="button"
                className="ring-offset-background focus:ring-ring ml-1 rounded-full outline-hidden focus:ring-2 focus:ring-offset-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUnselect(option);
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={() => handleUnselect(option)}>
                <X className="text-muted-foreground hover:text-foreground size-3" />
              </button>
            </Badge>
          ))}
          <CommandPrimitive.Input
            ref={inputRef}
            value={inputValue}
            onValueChange={setInputValue}
            onBlur={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className="placeholder:text-muted-foreground h-5 flex-1 border-0 bg-transparent pl-2 text-sm outline-hidden"
          />
        </div>
      </div>
      {open &&
        selectableOptions.length > 0 &&
        !disabled &&
        position &&
        globalThis.window !== undefined &&
        portalContainer &&
        createPortal(
          <div
            className="fixed z-100"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
              width: `${position.width}px`,
            }}>
            <CommandList className="max-h-none overflow-visible border-0">
              <div className="text-popover-foreground max-h-64 w-full overflow-auto rounded-md border border-slate-300 bg-white shadow-md outline-hidden animate-in">
                {optionGroups.map((group) => (
                  <CommandGroup
                    key={group.key}
                    heading={
                      group.label ? (
                        <span className="flex items-center gap-2">
                          {group.icon ? (
                            <span className="inline-flex size-5 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                              {group.icon}
                            </span>
                          ) : null}
                          {group.label}
                        </span>
                      ) : undefined
                    }>
                    {group.options.map((option) => (
                      <CommandItem
                        key={option.value}
                        disabled={option.disabled}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onSelect={() => {
                          if (disabled || option.disabled) return;
                          isUserInitiatedRef.current = true; // Mark as user-initiated
                          setSelected((prev) => [...prev, option]);
                          setInputValue("");
                        }}
                        className={cn(
                          "items-start gap-2",
                          option.disabled ? "cursor-not-allowed" : "cursor-pointer"
                        )}>
                        {option.icon ? (
                          <span className="mt-0.5 inline-flex items-center">{option.icon}</span>
                        ) : null}
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-slate-900">{option.label}</span>
                          {option.description ? (
                            <span className="mt-0.5 text-xs font-normal text-slate-400">
                              {option.description}
                            </span>
                          ) : null}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </div>
            </CommandList>
          </div>,
          portalContainer
        )}
    </Command>
  );
}
