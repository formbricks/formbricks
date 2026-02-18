"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { InputCombobox, TComboboxOption } from "@/modules/ui/components/input-combo-box";
import { getDistinctAttributeValuesAction } from "../actions";

interface AttributeValueInputProps {
  attributeKeyId: string;
  environmentId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  valueError?: string;
}

export const AttributeValueInput = ({
  attributeKeyId,
  environmentId,
  value,
  onChange,
  disabled,
  className,
  valueError,
}: AttributeValueInputProps) => {
  const [options, setOptions] = useState<TComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch on mount or when key params change
  useEffect(() => {
    // Don't fetch if we don't have a valid attributeKeyId
    if (!attributeKeyId || attributeKeyId === "") {
      return;
    }

    let isCancelled = false;

    const fetchDistinctValues = async () => {
      setLoading(true);
      try {
        const result = await getDistinctAttributeValuesAction({
          environmentId,
          attributeKeyId,
        });

        if (!isCancelled && result?.data) {
          const comboboxOptions: TComboboxOption[] = result.data.map((val) => ({
            label: val,
            value: val,
          }));

          setOptions(comboboxOptions);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Failed to fetch attribute values:", error);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchDistinctValues();

    return () => {
      isCancelled = true;
    };
  }, [environmentId, attributeKeyId]);

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
