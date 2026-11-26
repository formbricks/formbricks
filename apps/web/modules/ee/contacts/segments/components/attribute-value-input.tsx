"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { InputCombobox, TComboboxOption } from "@/modules/ui/components/input-combo-box";
import { useContactAttributeKeyValues } from "../hooks/use-segment-editor-options";

interface AttributeValueInputProps {
  readonly attributeKeyId: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly valueError?: string;
}

export const AttributeValueInput = ({
  attributeKeyId,
  value,
  onChange,
  disabled,
  className,
  valueError,
}: AttributeValueInputProps) => {
  const { data: values, isLoading: loading } = useContactAttributeKeyValues(attributeKeyId);
  const options: TComboboxOption[] = useMemo(
    () => (values ?? []).map((val) => ({ label: val, value: val })),
    [values]
  );

  const emptyDropdownText = useMemo(() => {
    if (loading) return "Loading values...";
    if (options.length === 50) return "Showing first 50 values";
    return "No values found";
  }, [loading, options.length]);

  return (
    <div className="relative">
      <InputCombobox
        id={`attribute-value-${attributeKeyId}`}
        options={options}
        value={value}
        onChangeValue={(newValue) => onChange(newValue as string)}
        withInput={true}
        showSearch={true}
        clearable={true}
        inputProps={{
          className: cn(
            "h-9 w-auto bg-white",
            valueError && "border border-red-500 focus:border-red-500",
            className
          ),
          disabled,
        }}
        comboboxClasses="h-9"
        emptyDropdownText={emptyDropdownText}
      />

      {valueError && (
        <p className="absolute right-2 -mt-1 rounded-md bg-white px-2 text-xs text-red-500">{valueError}</p>
      )}
    </div>
  );
};
