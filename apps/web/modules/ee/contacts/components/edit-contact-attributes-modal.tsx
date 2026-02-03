"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, HashIcon, PlusIcon, TagIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TContactAttributeDataType, TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import {
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { updateContactAttributesAction } from "../actions";
import { TEditContactAttributesForm, createEditContactAttributesSchema } from "../types/contact";

interface AttributeWithMetadata {
  key: string;
  name: string | null;
  value: string;
  dataType: TContactAttributeDataType;
}

interface EditContactAttributesModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  contactId: string;
  currentAttributes: AttributeWithMetadata[];
  attributeKeys: TContactAttributeKey[];
}

export const EditContactAttributesModal = ({
  open,
  setOpen,
  contactId,
  currentAttributes,
  attributeKeys,
}: EditContactAttributesModalProps) => {
  const { t } = useTranslation();
  const router = useRouter();

  // Create dynamic schema with type validation using factory function
  const dynamicSchema = useMemo(() => {
    return createEditContactAttributesSchema(attributeKeys, t);
  }, [attributeKeys, t]);

  // Convert current attributes to form format
  const defaultValues: TEditContactAttributesForm = useMemo(
    () => ({
      attributes: currentAttributes.map((attr) => ({
        key: attr.key,
        value: attr.value ?? "",
      })),
    }),
    [currentAttributes]
  );

  const form = useForm<TEditContactAttributesForm>({
    resolver: zodResolver(dynamicSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "attributes",
  });

  // Watch form values to get currently selected keys
  const watchedAttributes = form.watch("attributes");

  // Icon mapping for attribute data types
  const dataTypeIcons = {
    date: CalendarIcon,
    number: HashIcon,
    string: TagIcon,
  } as const;

  // Prepare select options from attribute keys
  const allKeyOptions = attributeKeys.map((attrKey) => ({
    icon: dataTypeIcons[attrKey.dataType] ?? TagIcon,
    label: attrKey.name ?? attrKey.key,
    value: attrKey.key,
  }));

  // Get available options for a specific field index (exclude already selected keys from other fields)
  const getAvailableOptions = (currentIndex: number) => {
    const selectedKeys = new Set(
      watchedAttributes
        .map((attr, index) => (index !== currentIndex && attr.key ? String(attr.key) : null))
        .filter((key): key is string => key !== null && key !== "")
    );

    return allKeyOptions.filter((option) => !selectedKeys.has(option.value));
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
    }
  }, [open, defaultValues, form]);

  // Scroll to first error on validation failure
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const errors = form.formState.errors;
    if (
      errors.attributes &&
      Array.isArray(errors.attributes) &&
      form.formState.isSubmitted &&
      formRef.current
    ) {
      // Find the first error field
      const firstErrorIndex = errors.attributes.findIndex((error) => error?.key || error?.value);

      if (firstErrorIndex !== -1) {
        const errorFieldId = `attribute-key-${firstErrorIndex}`;
        const errorElement = document.getElementById(errorFieldId);
        if (errorElement) {
          setTimeout(() => {
            errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
            // Try to focus the input inside the combobox if it exists
            const inputElement = errorElement.querySelector("input") as HTMLInputElement;
            if (inputElement) {
              inputElement.focus();
            } else {
              errorElement.focus();
            }
          }, 100);
        }
      }
    }
  }, [form.formState.errors, form.formState.isSubmitted]);

  const onSubmit = async (data: TEditContactAttributesForm) => {
    try {
      // Convert values based on attribute data type
      // HTML inputs always return strings, so we need to convert numbers
      const attributes = data.attributes.reduce(
        (acc, { key, value }) => {
          const attrKey = attributeKeys.find((ak) => ak.key === key);
          const dataType = attrKey?.dataType || "string";

          if (dataType === "number" && value !== "") {
            // Convert string to number for number attributes
            acc[key] = Number(value);
          } else {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, string | number>
      );

      const result = await updateContactAttributesAction({
        contactId,
        attributes,
      });

      if (result?.data) {
        toast.success(t("environments.contacts.edit_attributes_success"));

        if (result.data.messages && result.data.messages.length > 0) {
          result.data.messages.forEach((message) => {
            toast.error(message, { duration: 5000 });
          });
        }
        router.refresh();

        setOpen(false);
      } else {
        const errorMessage = getFormattedErrorMessage(result);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error("common.something_went_wrong");
      console.error(error);
    }
  };

  const handleAddAttribute = () => {
    append({ key: "", value: "" });
  };

  const handleRemoveAttribute = (index: number) => {
    remove(index);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent width="default" className="max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{t("environments.contacts.edit_attribute_values")}</DialogTitle>
          <DialogDescription>
            {t("environments.contacts.edit_attribute_values_description")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <FormProvider {...form}>
            <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <FormField
                      control={form.control}
                      name={`attributes.${index}.key`}
                      render={({ field: keyField }) => {
                        const availableOptions = getAvailableOptions(index);
                        const selectedOption = allKeyOptions.find((opt) => opt.value === keyField.value);
                        const Icon = selectedOption?.icon ?? TagIcon;

                        return (
                          <FormItem className="flex-1">
                            <FormLabel>{t("environments.contacts.attribute_key")}</FormLabel>
                            <FormControl>
                              <Select
                                value={keyField.value || undefined}
                                onValueChange={(value) => keyField.onChange(value)}>
                                <SelectTrigger id={`attribute-key-${index}`} className="w-full">
                                  {keyField.value ? (
                                    <span className="flex items-center gap-2">
                                      <Icon className="h-4 w-4 text-slate-400" />
                                      <span>{selectedOption?.label ?? keyField.value}</span>
                                    </span>
                                  ) : (
                                    <SelectValue
                                      placeholder={t("environments.contacts.select_attribute_key")}
                                    />
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
                        // Get the data type for this attribute key
                        const selectedKey = attributeKeys.find(
                          (ak) => ak.key === watchedAttributes[index]?.key
                        );
                        const dataType = selectedKey?.dataType || "string";

                        // Render input based on data type
                        const renderValueInput = () => {
                          if (dataType === "date") {
                            return (
                              <Input
                                type="date"
                                value={valueField.value ? valueField.value.split("T")[0] : ""}
                                onChange={(e) => {
                                  // NOSONAR - standard date input onchange, no need to take this out of the component
                                  const dateValue = e.target.value
                                    ? new Date(e.target.value).toISOString()
                                    : "";
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
                                    onClick={() => handleRemoveAttribute(index)}
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
                ))}
              </div>

              {/* Only show Add Attribute button if there are remaining attributes to add */}
              {watchedAttributes.length < attributeKeys.length && (
                <Button type="button" variant="secondary" onClick={handleAddAttribute} className="w-fit">
                  <PlusIcon className="mr-2 h-4 w-4" />
                  {t("environments.contacts.add_attribute")}
                </Button>
              )}

              {form.formState.errors.attributes?.root && (
                <FormError>{form.formState.errors.attributes.root.message}</FormError>
              )}

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" loading={form.formState.isSubmitting}>
                  {t("common.save_changes")}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
