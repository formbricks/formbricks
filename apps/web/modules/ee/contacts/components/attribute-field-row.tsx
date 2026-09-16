"use client";

import { CalendarIcon, HashIcon, TagIcon, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { formatLocalDay, parseStoredDay } from "@/lib/utils/datetime";
import { toUTCDateString } from "@/modules/ee/contacts/segments/lib/date-utils";
import { Button } from "@/modules/ui/components/button";
import { DatePicker } from "@/modules/ui/components/date-picker";
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
  // Only the resolved language is read here; `t` stays prop-drilled from the modal that owns the form.
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
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
              <FormLabel>{t("workspace.contacts.attribute_key")}</FormLabel>
              <FormControl>
                <Select
                  value={keyField.value || undefined}
                  onValueChange={(value) => keyField.onChange(value)}
                  disabled={savedAttributeKeys.has(keyField.value)}>
                  <SelectTrigger id={`attribute-key-${index}`} className="h-10 w-full">
                    {keyField.value ? (
                      <span className="flex items-center gap-2">
                        <Icon className="size-4 text-slate-400" />
                        <span>{selectedOption?.label ?? keyField.value}</span>
                      </span>
                    ) : (
                      <SelectValue placeholder={t("workspace.contacts.select_attribute_key")} />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {availableOptions.map((option) => {
                      const OptionIcon = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex items-center gap-2">
                            <OptionIcon className="size-4 text-slate-400" />
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
                <div className="flex-1">
                  <DatePicker
                    value={parseStoredDay(valueField.value)}
                    locale={locale}
                    triggerClassName="h-10 w-full"
                    onChange={(date) => valueField.onChange(toUTCDateString(formatLocalDay(date)))}
                  />
                </div>
              );
            }

            if (dataType === "number") {
              return (
                <Input
                  type="number"
                  {...valueField}
                  placeholder={t("workspace.contacts.attribute_value_placeholder")}
                  className="w-full"
                />
              );
            }

            return (
              <Input
                type="text"
                {...valueField}
                placeholder={t("workspace.contacts.attribute_value_placeholder")}
                className="w-full"
              />
            );
          };

          return (
            <FormItem className="flex-1">
              <FormLabel>{t("workspace.contacts.attribute_value")}</FormLabel>
              <FormControl>
                <div className="flex gap-x-2">
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
                      className="size-10 p-0">
                      <TrashIcon className="size-4" />
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
