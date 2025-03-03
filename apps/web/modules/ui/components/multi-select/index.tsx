"use client";

import { Command, CommandGroup, CommandItem, CommandList } from "@/modules/ui/components/command";
import { Badge } from "@/modules/ui/components/multi-select/badge";
import { Command as CommandPrimitive } from "cmdk";
import { X } from "lucide-react";
import * as React from "react";

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

  React.useEffect(() => {
    if (value) {
      setSelected(
        value.map((val) => options.find((o) => o.value === val)).filter((o): o is TOption<T> => !!o)
      );
    }
  }, [value, options]);

  const handleUnselect = React.useCallback(
    (option: TOption<T>) => {
      if (disabled) return;
      setSelected((prev) => {
        const newSelected = prev.filter((s) => s.value !== option.value);
        onChange?.(newSelected.map((s) => s.value) as K);
        return newSelected;
      });
    },
    [onChange, disabled]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const input = inputRef.current;
      if (!input || disabled) return;

      if ((e.key === "Delete" || e.key === "Backspace") && input.value === "") {
        setSelected((prev) => {
          const newSelected = [...prev];
          newSelected.pop();
          onChange?.(newSelected.map((s) => s.value) as K);
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

  return (
    <Command
      onKeyDown={handleKeyDown}
      className={`overflow-visible bg-white ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
      <div
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
      {open && selectableOptions.length > 0 && !disabled && (
        <div className="relative mt-2">
          <CommandList>
            <div className="text-popover-foreground animate-in absolute top-0 z-10 max-h-32 w-full rounded-md border bg-white shadow-md outline-none">
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
                      const newSelected = [...selected, option];
                      setSelected(newSelected);
                      onChange?.(newSelected.map((o) => o.value) as K);
                      setInputValue("");
                    }}
                    className="cursor-pointer">
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          </CommandList>
        </div>
      )}
    </Command>
  );
}
