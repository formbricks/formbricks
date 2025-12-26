"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
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

const ZAttributeRow = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.string(),
});

const ZEditContactAttributesForm = z.object({
  attributes: z
    .array(ZAttributeRow)
    .min(1, "At least one attribute is required")
    .superRefine((attributes, ctx) => {
      // Check for duplicate keys
      const keys = attributes.map((attr) => attr.key);
      const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
      if (duplicateKeys.length > 0) {
        const uniqueDuplicates = Array.from(new Set(duplicateKeys));
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate keys found: ${uniqueDuplicates.join(", ")}`,
          path: [],
        });
      }

      // Validate email format if key is "email"
      attributes.forEach((attr, index) => {
        if (attr.key === "email" && attr.value && attr.value.trim() !== "") {
          const emailResult = z.string().email().safeParse(attr.value);
          if (!emailResult.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Invalid email format",
              path: [index, "value"],
            });
          }
        }
      });
    }),
});

type TEditContactAttributesForm = z.infer<typeof ZEditContactAttributesForm>;

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
  const defaultValues: TEditContactAttributesForm = {
    attributes: Object.entries(currentAttributes).map(([key, value]) => ({
      key,
      value: value ?? "",
    })),
  };

  const form = useForm<TEditContactAttributesForm>({
    resolver: zodResolver(ZEditContactAttributesForm),
    defaultValues,
  });

  // Reset form when contactId or currentAttributes change
  useEffect(() => {
    const newDefaultValues: TEditContactAttributesForm = {
      attributes: Object.entries(currentAttributes).map(([key, value]) => ({
        key,
        value: value ?? "",
      })),
    };
    form.reset(newDefaultValues);
  }, [contactId, currentAttributes, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "attributes",
  });

  // Prepare combobox options from attribute keys
  const keyOptions: TComboboxOption[] = attributeKeys.map((attrKey) => ({
    label: attrKey.name ?? attrKey.key,
    value: attrKey.key,
  }));

  const onSubmit = async (data: TEditContactAttributesForm) => {
    const attributes: TContactAttributes = {};
    data.attributes.forEach(({ key, value }) => {
      attributes[key] = value;
    });

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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                              options={keyOptions}
                              value={keyField.value || null}
                              onChangeValue={(value) => {
                                keyField.onChange(typeof value === "string" ? value : String(value || ""));
                              }}
                              withInput={true}
                              showSearch={true}
                              inputProps={{
                                placeholder: t("environments.contacts.attribute_key_placeholder"),
                                className: "w-full",
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

                    <div className="flex items-end pb-2">
                      <Button
                        type="button"
                        variant="ghost"
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

              <Button type="button" variant="outline" onClick={handleAddAttribute} className="w-fit">
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
