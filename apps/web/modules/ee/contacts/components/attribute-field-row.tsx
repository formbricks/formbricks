"use client";

import { CalendarIcon, HashIcon, TagIcon, TrashIcon } from "lucide-react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

type KeyOption = {
  icon: typeof CalendarIcon | typeof HashIcon | typeof TagIcon;
  label: string;
  value: string;
};

interface AttributeFieldRowProps {
  index: number;
  fieldId: string;
  form: any;
  attributeKeys: TContactAttributeKey[];
  watchedAttributes: { key: string; value: string }[];
  allKeyOptions: KeyOption[];
  getAvailableOptions: (index: number) => KeyOption[];
  savedAttributeKeys: Set<string>;
  onRemove: (index: number) => void;
  t: (key: string) => string;
}

export const AttributeFieldRow = ({
  index,
  fieldId,
  form,
  attributeKeys,
  watchedAttributes,
  allKeyOptions,
  getAvailableOptions,
  savedAttributeKeys,
  onRemove,
  t,
}: AttributeFieldRowProps) => {
  const availableOptions = getAvailableOptions(index);

  return (
    <div key={fieldId} className="flex gap-2">
      <FormField
        control={form.control}
        name={`attributes.${index}.key`}
        render={({ field: keyField }) => {
          const selectedOption = allKeyOptions.find((opt) => opt.value === keyField.value);
          const Icon = selectedOption?.icon ?? TagIcon;

          return (
            <FormItem className="flex-1">
              <FormLabel>{t("environments.contacts.attribute_key")}</FormLabel>
              <FormControl>
                <Select
                  value={keyField.value || undefined}
                  onValueChange={(value) => keyField.onChange(value)}
                  disabled={savedAttributeKeys.has(keyField.value)}>
                  <SelectTrigger id={`attribute-key-${index}`} className="h-10 w-full">
                    {keyField.value ? (
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-slate-400" />
                        <span>{selectedOption?.label ?? keyField.value}</span>
                      </span>
                    ) : (
                      <SelectValue placeholder={t("environments.contacts.select_attribute_key")} />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {availableOptions.map((option) => {
                      const OptionIcon = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex items-center gap-2">
                            <OptionIcon className="h-4 w-4 text-slate-400" />
                            <span>{option.label}</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormError />
            </FormItem>
          );
        }}
      />

      <FormField
        control={form.control}
        name={`attributes.${index}.value`}
        render={({ field: valueField }) => {
          const selectedKey = attributeKeys.find((ak) => ak.key === watchedAttributes[index]?.key);
          const dataType = selectedKey?.dataType || "string";

          const renderValueInput = () => {
            if (dataType === "date") {
              return (
                <Input
                  type="date"
                  value={valueField.value ? valueField.value.split("T")[0] : ""}
                  onChange={(e) => {
                    const dateValue = e.target.value ? new Date(e.target.value).toISOString() : "";
                    valueField.onChange(dateValue);
                  }}
                  placeholder={t("environments.contacts.attribute_value_placeholder")}
                  className="w-full"
                />
              );
            }

            if (dataType === "number") {
              return (
                <Input
                  type="number"
                  {...valueField}
                  placeholder={t("environments.contacts.attribute_value_placeholder")}
                  className="w-full"
                />
              );
            }

            return (
              <Input
                type="text"
                {...valueField}
                placeholder={t("environments.contacts.attribute_value_placeholder")}
                className="w-full"
              />
            );
          };

          return (
            <FormItem className="flex-1">
              <FormLabel>{t("environments.contacts.attribute_value")}</FormLabel>
              <FormControl>
                <div className="flex space-x-2">
                  {renderValueInput()}
                  <div className="flex items-end pb-0.5">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={["email", "userId", "firstName", "lastName"].includes(
                        watchedAttributes[index]?.key ?? ""
                      )}
                      size="sm"
                      onClick={() => onRemove(index)}
                      className="h-10 w-10 p-0">
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </FormControl>
              <FormError />
            </FormItem>
          );
        }}
      />
    </div>
  );
};
