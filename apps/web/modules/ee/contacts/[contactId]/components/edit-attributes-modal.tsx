"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { TContactAttributeDataType, TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  deleteContactAttributeAction,
  updateContactAttributesAction,
} from "@/modules/ee/contacts/[contactId]/actions";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
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

interface AttributeWithMetadata {
  key: string;
  name: string | null;
  value: string;
  dataType: TContactAttributeDataType;
}

interface EditAttributesModalProps {
  contactId: string;
  attributes: AttributeWithMetadata[];
  allAttributeKeys: TContactAttributeKey[];
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function EditAttributesModal({
  contactId,
  attributes,
  allAttributeKeys,
  open,
  setOpen,
}: EditAttributesModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletedKeys, setDeletedKeys] = useState<Set<string>>(new Set());
  const [deletingKeys, setDeletingKeys] = useState<Set<string>>(new Set());
  const [selectedNewAttributeKey, setSelectedNewAttributeKey] = useState<string>("");
  const [newAttributeValue, setNewAttributeValue] = useState<string>("");

  // Reset deleted keys when modal opens
  useEffect(() => {
    if (open) {
      setDeletedKeys(new Set());
    }
  }, [open]);

  // Filter out protected attributes and locally deleted ones
  const editableAttributes = useMemo(() => {
    return attributes.filter(
      (attr) => attr.key !== "contactId" && attr.key !== "userId" && !deletedKeys.has(attr.key)
    );
  }, [attributes, deletedKeys]);

  // Get available attribute keys that are not yet assigned to this contact (including deleted ones)
  const availableAttributeKeys = useMemo(() => {
    const currentKeys = new Set(editableAttributes.map((attr) => attr.key));
    return allAttributeKeys.filter((key) => !currentKeys.has(key.key) && key.key !== "userId");
  }, [editableAttributes, allAttributeKeys]);

  const selectedAttributeKey = useMemo(() => {
    return allAttributeKeys.find((key) => key.key === selectedNewAttributeKey);
  }, [selectedNewAttributeKey, allAttributeKeys]);

  // Create schema dynamically based on current editable attributes
  const attributeSchema = useMemo(() => {
    return z.object(
      editableAttributes.reduce(
        (acc, attr) => {
          // Add specific validation for known attributes
          if (attr.key === "email") {
            acc[attr.key] = z.string().email({ message: "Invalid email address" });
          } else if (attr.key === "language") {
            acc[attr.key] = z.string().min(2, { message: "Language code must be at least 2 characters" });
          } else {
            // Generic string validation for other attributes
            acc[attr.key] = z.string();
          }
          return acc;
        },
        {} as Record<string, z.ZodString | z.ZodEffects<z.ZodString>>
      )
    );
  }, [editableAttributes]);

  type TAttributeForm = z.infer<typeof attributeSchema>;

  const form = useForm<TAttributeForm>({
    resolver: zodResolver(attributeSchema),
    defaultValues: editableAttributes.reduce(
      (acc, attr) => {
        acc[attr.key] = attr.value;
        return acc;
      },
      {} as Record<string, string>
    ),
  });

  // Update form when editable attributes change
  useEffect(() => {
    const newDefaults = editableAttributes.reduce(
      (acc, attr) => {
        acc[attr.key] = attr.value;
        return acc;
      },
      {} as Record<string, string>
    );
    form.reset(newDefaults);
  }, [editableAttributes, form]);

  const onSubmit = async (data: TAttributeForm) => {
    setIsSubmitting(true);
    try {
      const result = await updateContactAttributesAction({
        contactId,
        attributes: data,
      });

      if (result?.data) {
        toast.success(t("environments.contacts.attributes_updated_successfully"));
        router.refresh();
        setOpen(false);
      } else {
        const errorMessage = getFormattedErrorMessage(result);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAttribute = async (attributeKey: string) => {
    // Confirm deletion for important attributes
    if (attributeKey === "email" || attributeKey === "language") {
      const confirmed = globalThis.confirm(
        t("environments.contacts.confirm_delete_attribute", {
          attributeName: attributeKey,
        })
      );
      if (!confirmed) return;
    }

    setDeletingKeys((prev) => new Set(prev).add(attributeKey));
    try {
      const result = await deleteContactAttributeAction({
        contactId,
        attributeKey,
      });

      if (result?.data) {
        toast.success(t("environments.contacts.attribute_deleted_successfully"));
        // Mark as deleted locally and remove from form
        setDeletedKeys((prev) => new Set(prev).add(attributeKey));
        form.unregister(attributeKey);
        router.refresh();
        // Keep modal open so user can see the attribute is now available to add
      } else {
        const errorMessage = getFormattedErrorMessage(result);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setDeletingKeys((prev) => {
        const newSet = new Set(prev);
        newSet.delete(attributeKey);
        return newSet;
      });
    }
  };

  const handleAddAttribute = async () => {
    if (!selectedNewAttributeKey || !newAttributeValue) {
      toast.error(t("environments.contacts.please_select_attribute_and_value"));
      return;
    }

    // Validate based on data type
    const selectedKey = selectedAttributeKey;
    if (selectedKey?.dataType === "date") {
      const date = new Date(newAttributeValue);
      if (Number.isNaN(date.getTime())) {
        toast.error(t("environments.contacts.invalid_date_value"));
        return;
      }
    } else if (selectedKey?.key === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newAttributeValue)) {
        toast.error(t("environments.contacts.invalid_email_value"));
        return;
      }
    }

    try {
      const result = await updateContactAttributesAction({
        contactId,
        attributes: {
          [selectedNewAttributeKey]: newAttributeValue,
        },
      });

      if (result?.data) {
        toast.success(t("environments.contacts.attribute_added_successfully"));
        // Add to form dynamically
        form.setValue(selectedNewAttributeKey, newAttributeValue);
        // Remove from deleted keys if it was previously deleted
        setDeletedKeys((prev) => {
          const newSet = new Set(prev);
          newSet.delete(selectedNewAttributeKey);
          return newSet;
        });
        setSelectedNewAttributeKey("");
        setNewAttributeValue("");
        router.refresh();
      } else {
        const errorMessage = getFormattedErrorMessage(result);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("environments.contacts.edit_attributes")}</DialogTitle>
        </DialogHeader>

        <DialogBody className="max-h-[60vh] overflow-y-auto pb-4 pr-6">
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <AnimatePresence mode="popLayout">
                {editableAttributes.map((attr) => (
                  <motion.div
                    key={attr.key}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}>
                    <FormField
                      control={form.control}
                      name={attr.key}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <div className="flex items-center gap-2">
                              <span>{attr.name || attr.key}</span>
                              <Badge text={attr.dataType} type="gray" size="tiny" />
                            </div>
                          </FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              {attr.dataType === "date" ? (
                                <Input
                                  type="date"
                                  {...field}
                                  value={field.value ? field.value.split("T")[0] : ""}
                                  onChange={(e) => {
                                    const dateValue = e.target.value
                                      ? new Date(e.target.value).toISOString()
                                      : "";
                                    field.onChange(dateValue);
                                  }}
                                />
                              ) : attr.dataType === "number" ? (
                                <Input type="number" {...field} />
                              ) : (
                                <Input type="text" {...field} />
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => handleDeleteAttribute(attr.key)}
                                disabled={deletingKeys.has(attr.key)}
                                loading={deletingKeys.has(attr.key)}
                                title={t("common.delete")}>
                                <Trash2Icon className="h-4 w-4" />
                              </Button>
                            </div>
                          </FormControl>
                          <FormError />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Add New Attribute Section */}
              {availableAttributeKeys.length > 0 && (
                <>
                  <hr className="my-6" />
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-slate-900">
                      {t("environments.contacts.add_attribute")}
                    </h3>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs text-slate-600">
                          {t("environments.contacts.select_attribute")}
                        </label>
                        <Select
                          value={selectedNewAttributeKey}
                          onValueChange={(value) => {
                            setSelectedNewAttributeKey(value);
                            setNewAttributeValue("");
                          }}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("environments.contacts.select_attribute")} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableAttributeKeys.map((key) => (
                              <SelectItem key={key.id} value={key.key}>
                                <div className="flex items-center gap-2">
                                  <Badge text={key.dataType} type="gray" size="tiny" />
                                  <span>{key.name || key.key}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedNewAttributeKey && (
                        <div className="flex-1">
                          <label className="mb-1 block text-xs text-slate-600">{t("common.value")}</label>
                          {selectedAttributeKey?.dataType === "date" ? (
                            <Input
                              type="date"
                              value={newAttributeValue ? newAttributeValue.split("T")[0] : ""}
                              onChange={(e) => {
                                const dateValue = e.target.value
                                  ? new Date(e.target.value).toISOString()
                                  : "";
                                setNewAttributeValue(dateValue);
                              }}
                            />
                          ) : selectedAttributeKey?.dataType === "number" ? (
                            <Input
                              type="number"
                              value={newAttributeValue}
                              onChange={(e) => setNewAttributeValue(e.target.value)}
                              placeholder={t("common.enter_value")}
                            />
                          ) : (
                            <Input
                              type="text"
                              value={newAttributeValue}
                              onChange={(e) => setNewAttributeValue(e.target.value)}
                              placeholder={t("common.enter_value")}
                            />
                          )}
                        </div>
                      )}

                      <Button
                        type="button"
                        onClick={handleAddAttribute}
                        disabled={!selectedNewAttributeKey || !newAttributeValue}>
                        <PlusIcon className="h-4 w-4" />
                        {t("common.add")}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </form>
          </FormProvider>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSubmitting || !form.formState.isDirty}
            loading={isSubmitting}>
            {t("common.save_changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
