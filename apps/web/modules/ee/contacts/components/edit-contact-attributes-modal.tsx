"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, HashIcon, PlusIcon, TagIcon } from "lucide-react";
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
import { FormError, FormProvider } from "@/modules/ui/components/form";
import { updateContactAttributesAction } from "../actions";
import { TEditContactAttributesForm, createEditContactAttributesSchema } from "../types/contact";
import { AttributeFieldRow } from "./attribute-field-row";

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

  // Track which attributes were already saved (should be disabled)
  const savedAttributeKeys = useMemo(
    () => new Set(currentAttributes.map((attr) => attr.key)),
    [currentAttributes]
  );

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
              {fields.length > 0 && (
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <AttributeFieldRow
                      key={field.id}
                      index={index}
                      fieldId={field.id}
                      form={form}
                      attributeKeys={attributeKeys}
                      watchedAttributes={watchedAttributes}
                      allKeyOptions={allKeyOptions}
                      getAvailableOptions={getAvailableOptions}
                      savedAttributeKeys={savedAttributeKeys}
                      onRemove={handleRemoveAttribute}
                      t={t}
                    />
                  ))}
                </div>
              )}

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
