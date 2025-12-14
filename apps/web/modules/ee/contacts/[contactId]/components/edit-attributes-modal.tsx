"use client";

import { PlusIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { AttributeIcon } from "@/modules/ee/contacts/segments/components/attribute-icon";
import { Button } from "@/modules/ui/components/button";
import { DatePicker } from "@/modules/ui/components/date-picker";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { deleteContactAttributeAction, updateContactAttributeAction } from "../actions";

interface EditAttributesModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  contactId: string;
  attributes: TContactAttributes;
  attributeKeys: TContactAttributeKey[];
}

export const EditAttributesModal = ({
  open,
  setOpen,
  contactId,
  attributes,
  attributeKeys,
}: EditAttributesModalProps) => {
  const router = useRouter();
  const { t } = useTranslation();

  // Local state for editing. explicit key-value pairs array for easier rendering
  const [localAttributes, setLocalAttributes] = useState<
    { key: string; value: string | number | Date; isNew?: boolean }[]
  >(
    Object.entries(attributes)
      .filter(([key]) => key !== "email" && key !== "userId" && key !== "language") // exclude standard/read-only attributes from generic editor?
      .map(([key, value]) => ({ key, value }))
  );

  const [isSaving, setIsSaving] = useState(false);

  // Deletion state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [attributeToDelete, setAttributeToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const availableKeys = useMemo(() => {
    // Filter out keys that are already used (except for the one being edited if we supported key change, but we lock key for existing)
    // Actually for new rows we want to show unused keys.
    const usedKeys = new Set(localAttributes.map((a) => a.key));
    return attributeKeys.filter((ak) => !usedKeys.has(ak.key));
  }, [attributeKeys, localAttributes]);

  const handleUpdateAttribute = (index: number, field: "key" | "value", newValue: any) => {
    const updated = [...localAttributes];
    updated[index] = { ...updated[index], [field]: newValue };
    setLocalAttributes(updated);
  };

  const handleAddAttribute = () => {
    setLocalAttributes([...localAttributes, { key: "", value: "", isNew: true }]);
  };

  const handleRemoveAttribute = (index: number) => {
    const attribute = localAttributes[index];
    if (attribute.isNew) {
      // Just remove from state
      const updated = [...localAttributes];
      updated.splice(index, 1);
      setLocalAttributes(updated);
    } else {
      // Trigger delete confirmation for existing attributes
      setAttributeToDelete(attribute.key);
      setDeleteDialogOpen(true);
    }
  };

  const confirmDelete = async () => {
    if (!attributeToDelete) return;
    setIsDeleting(true);
    const result = await deleteContactAttributeAction({ contactId, attributeKey: attributeToDelete });
    setIsDeleting(false);
    setDeleteDialogOpen(false);

    if (result?.data?.success) {
      toast.success("Attribute deleted successfully");
      setLocalAttributes(localAttributes.filter((a) => a.key !== attributeToDelete));
      setAttributeToDelete(null);
      router.refresh();
    } else {
      toast.error(getFormattedErrorMessage(result));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Convert array back to record
    const attributesRecord: TContactAttributes = {};
    for (const attr of localAttributes) {
      if (attr.key && attr.value !== "") {
        attributesRecord[attr.key] = attr.value;
      }
    }

    const result = await updateContactAttributeAction({
      contactId,
      attributes: attributesRecord,
    });

    setIsSaving(false);

    if (result?.data?.success) {
      toast.success("Attributes updated successfully");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(getFormattedErrorMessage(result));
    }
  };

  // Helper to determine input type based on key
  const getInputType = (key: string) => {
    const attributeKey = attributeKeys.find((ak) => ak.key === key);
    return attributeKey?.dataType ?? "text";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle>{t("common.edit_attributes")}</DialogTitle>
          </DialogHeader>
          <DialogBody className="max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-4">
              {localAttributes.length === 0 && (
                <p className="text-sm italic text-slate-500">No custom attributes found.</p>
              )}

              {localAttributes.map((attr, index) => {
                const dataType = getInputType(attr.key);

                return (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-1">
                      <Label className="mb-1 block text-xs">Key</Label>
                      {attr.isNew ? (
                        <div className="relative">
                          <Input
                            value={attr.key}
                            onChange={(e) => handleUpdateAttribute(index, "key", e.target.value)}
                            placeholder="Attribute Key"
                            list={`keys-${index}`}
                          />
                          {/* Simple datalist for suggestion */}
                          <datalist id={`keys-${index}`}>
                            {availableKeys.map((ak) => (
                              <option key={ak.id} value={ak.key} />
                            ))}
                          </datalist>
                        </div>
                      ) : (
                        <Input value={attr.key} disabled className="bg-slate-50" />
                      )}
                    </div>

                    <div className="flex-1">
                      <Label className="mb-1 flex items-center gap-2 text-xs">
                        Value
                        <AttributeIcon dataType={dataType} className="h-3 w-3 text-slate-400" />
                      </Label>

                      {dataType === "date" ? (
                        <DatePicker
                          date={
                            attr.value instanceof Date
                              ? attr.value
                              : attr.value
                                ? new Date(attr.value as string)
                                : null
                          }
                          updateSurveyDate={(date) => handleUpdateAttribute(index, "value", date ?? "")}
                        />
                      ) : (
                        <Input
                          type={dataType === "number" ? "number" : "text"}
                          value={attr.value instanceof Date ? "" : attr.value}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (dataType === "number") {
                              handleUpdateAttribute(index, "value", val === "" ? "" : Number(val));
                            } else {
                              handleUpdateAttribute(index, "value", val);
                            }
                          }}
                        />
                      )}
                    </div>

                    <div className="mt-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAttribute(index)}
                        type="button">
                        <TrashIcon className="h-4 w-4 text-slate-500 hover:text-red-500" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              <Button variant="outline" size="sm" onClick={handleAddAttribute} className="mt-2">
                <PlusIcon className="mr-2 h-4 w-4" />
                Add Attribute
              </Button>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              {t("common.save_changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={deleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        deleteWhat="attribute"
        onDelete={confirmDelete}
        isDeleting={isDeleting}
        text={`Are you sure you want to delete the attribute "${attributeToDelete}"? This action cannot be undone.`}
      />
    </>
  );
};
