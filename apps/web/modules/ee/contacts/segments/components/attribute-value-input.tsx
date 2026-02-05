"use client";

import { useEffect, useMemo, useState } from "react";
import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { cn } from "@/lib/cn";
import { InputCombobox, TComboboxOption } from "@/modules/ui/components/input-combo-box";
import { getDistinctAttributeValuesAction } from "../actions";

interface AttributeValueInputProps {
  attributeKeyId: string;
  environmentId: string;
  dataType: TContactAttributeDataType;
  value: string | number;
  onChange: (value: string | number) => void;
  disabled?: boolean;
  className?: string;
  valueError?: string;
}

export const AttributeValueInput = ({
  attributeKeyId,
  environmentId,
  dataType,
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
          dataType,
        });

        if (!isCancelled && result?.data) {
          const comboboxOptions: TComboboxOption[] = result.data.map((val) => ({
            label: String(val),
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
  }, [environmentId, attributeKeyId, dataType]);

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
        onChangeValue={(newValue) => onChange(newValue as string | number)}
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
