"use client";

import { Badge } from "@/modules/ui/components/badge";
import { Command, CommandGroup, CommandItem, CommandList } from "@/modules/ui/components/command";
import { Command as CommandPrimitive } from "cmdk";
import { X } from "lucide-react";
import * as React from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface FancyMultiSelectProps<T extends SelectOption> {
  options: T[];
  value?: T[];
  onChange?: (selected: T[]) => void;
  placeholder?: string;
}

export function FancyMultiSelect<T extends SelectOption>(props: FancyMultiSelectProps<T>) {
  const { options, value, onChange, placeholder = "Select options..." } = props;

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<T[]>(value || []);
  const [inputValue, setInputValue] = React.useState("");

  // When `value` prop changes from outside, sync with local state
  React.useEffect(() => {
    if (value) {
      setSelected(value);
    }
  }, [value]);

  const handleUnselect = React.useCallback(
    (option: T) => {
      setSelected((prev) => {
        const newSelected = prev.filter((s) => s.value !== option.value);
        onChange?.(newSelected);
        return newSelected;
      });
    },
    [onChange]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const input = inputRef.current;
      if (input) {
        if (e.key === "Delete" || e.key === "Backspace") {
          if (input.value === "") {
            setSelected((prev) => {
              const newSelected = [...prev];
              newSelected.pop();
              onChange?.(newSelected);
              return newSelected;
            });
          }
        }
        // This is not a default behaviour of the <input /> field
        if (e.key === "Escape") {
          input.blur();
        }
      }
    },
    [onChange]
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
    <Command onKeyDown={handleKeyDown} className="overflow-visible bg-transparent">
      <div className="border-input ring-offset-background focus-within:ring-ring group rounded-md border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-offset-2">
        <div className="flex flex-wrap gap-1">
          {selected.map((option) => (
            <Badge key={option.value} variant="gray" size="tiny">
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
            className="placeholder:text-muted-foreground ml-2 flex-1 bg-transparent outline-none"
          />
        </div>
      </div>
      <div className="relative mt-2">
        <CommandList>
          {open && selectableOptions.length > 0 ? (
            <div className="bg-popover text-popover-foreground animate-in absolute top-0 z-10 w-full rounded-md border shadow-md outline-none">
              <CommandGroup className="h-full overflow-auto">
                {selectableOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onSelect={() => {
                      const newSelected = [...selected, option];
                      setSelected(newSelected);
                      onChange?.(newSelected);
                      setInputValue("");
                    }}
                    className="cursor-pointer">
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          ) : null}
        </CommandList>
      </div>
    </Command>
  );
}
