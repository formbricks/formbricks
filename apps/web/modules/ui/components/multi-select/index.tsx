"use client";

import { Command as CommandPrimitive } from "cmdk";
import { X } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import { Command, CommandGroup, CommandItem, CommandList } from "@/modules/ui/components/command";
import { Badge } from "@/modules/ui/components/multi-select/badge";

interface TOption<T> {
  value: T;
  label: string;
}

interface MultiSelectProps<T extends string, K extends TOption<T>["value"][]> {
  options: TOption<T>[];
  value?: K;
  onChange?: (selected: K) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MultiSelect<T extends string, K extends TOption<T>["value"][]>(
  props: MultiSelectProps<T, K>
) {
  const { options, value, onChange, disabled = false, placeholder = "Select options..." } = props;

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
        return o.label.toLowerCase().includes(inputValue.toLowerCase());
      });
  }, [options, selected, inputValue]);

  // Calculate position for dropdown when opening
  React.useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    } else {
      setPosition(null);
    }
  }, [open]);

  return (
    <Command
      onKeyDown={handleKeyDown}
      className={`relative overflow-visible bg-white ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
      <div
        ref={containerRef}
        className={`border-input ring-offset-background group rounded-md border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-offset-2 ${
          disabled ? "pointer-events-none" : "focus-within:ring-ring"
        }`}>
        <div className="flex flex-wrap gap-1">
          {selected.map((option) => (
            <Badge key={option.value} className="rounded-md">
              {option.label}
              <button
                className="ring-offset-background focus:ring-ring ml-1 rounded-full outline-none focus:ring-2 focus:ring-offset-2"
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
                <X className="text-muted-foreground hover:text-foreground h-3 w-3" />
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
            className="placeholder:text-muted-foreground h-5 flex-1 border-0 bg-transparent pl-2 text-sm outline-none"
          />
        </div>
      </div>
      {open &&
        selectableOptions.length > 0 &&
        !disabled &&
        position &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[100]"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
              width: `${position.width}px`,
            }}>
            <CommandList className="border-0">
              <div className="text-popover-foreground animate-in max-h-32 w-full overflow-auto rounded-md border border-slate-300 bg-white shadow-md outline-none">
                <CommandGroup className="h-full overflow-auto">
                  {selectableOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onSelect={() => {
                        if (disabled) return;
                        isUserInitiatedRef.current = true; // Mark as user-initiated
                        setSelected((prev) => [...prev, option]);
                        setInputValue("");
                      }}
                      className="cursor-pointer">
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            </CommandList>
          </div>,
          document.body
        )}
    </Command>
  );
}
