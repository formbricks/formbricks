"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
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
import { InputCombobox, TComboboxOption } from "@/modules/ui/components/input-combo-box";
import { updateContactAttributesAction } from "../actions";
import { TEditContactAttributesForm, ZEditContactAttributesForm } from "../types/contact";

interface EditContactAttributesModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  contactId: string;
  currentAttributes: TContactAttributes;
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
  // Convert current attributes to form format
  const defaultValues: TEditContactAttributesForm = useMemo(
    () => ({
      attributes: Object.entries(currentAttributes).map(([key, value]) => ({
        key,
        value: value ?? "",
      })),
    }),
    [currentAttributes]
  );

  const form = useForm<TEditContactAttributesForm>({
    resolver: zodResolver(ZEditContactAttributesForm),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "attributes",
  });

  // Watch form values to get currently selected keys
  const watchedAttributes = form.watch("attributes");

  // Prepare combobox options from attribute keys
  const allKeyOptions: TComboboxOption[] = attributeKeys.map((attrKey) => ({
    label: attrKey.name ?? attrKey.key,
    value: attrKey.key,
  }));

  // Get available options for a specific field index (exclude already selected keys from other fields)
  const getAvailableOptions = (currentIndex: number): TComboboxOption[] => {
    const selectedKeys = new Set(
      watchedAttributes
        .map((attr, index) => (index !== currentIndex && attr.key ? String(attr.key) : null))
        .filter((key): key is string => key !== null && key !== "")
    );

    return allKeyOptions.filter((option) => !selectedKeys.has(String(option.value)));
  };

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
      const attributes = data.attributes.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
      }, {});

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
                      render={({ field: keyField }) => (
                        <FormItem className="flex-1">
                          <FormLabel>{t("environments.contacts.attribute_key")}</FormLabel>
                          <FormControl>
                            <InputCombobox
                              id={`attribute-key-${index}`}
                              options={getAvailableOptions(index)}
                              value={keyField.value || null}
                              onChangeValue={(value) => {
                                keyField.onChange(typeof value === "string" ? value : String(value || ""));
                              }}
                              withInput={true}
                              showSearch={true}
                              inputProps={{
                                placeholder: t("environments.contacts.attribute_key_placeholder"),
                                className: "w-full border-0",
                              }}
                            />
                          </FormControl>
                          <FormError />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`attributes.${index}.value`}
                      render={({ field: valueField }) => (
                        <FormItem className="flex-1">
                          <FormLabel>{t("environments.contacts.attribute_value")}</FormLabel>
                          <FormControl>
                            <Input
                              {...valueField}
                              placeholder={t("environments.contacts.attribute_value_placeholder")}
                              className="w-full"
                            />
                          </FormControl>
                          <FormError />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-end pb-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={["email", "userId", "firstName", "lastName"].includes(field.key)}
                        size="sm"
                        onClick={() => handleRemoveAttribute(index)}
                        className="h-10 w-10 p-0">
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button type="button" variant="secondary" onClick={handleAddAttribute} className="w-fit">
                <PlusIcon className="mr-2 h-4 w-4" />
                {t("environments.contacts.add_attribute")}
              </Button>

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
