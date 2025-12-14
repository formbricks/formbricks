"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { deleteAttributeKeyAction } from "./actions";
// updated imports
import { AttributeKeysTable } from "./attribute-keys-table";
import { CreateAttributeKeyModal } from "./create-attribute-key-modal";
import { EditAttributeKeyModal } from "./edit-attribute-key-modal";

interface AttributeKeysManagerProps {
  environmentId: string;
  attributeKeys: TContactAttributeKey[];
}

export const AttributeKeysManager = ({ environmentId, attributeKeys }: AttributeKeysManagerProps) => {
  const router = useRouter();
  const { t } = useTranslation();

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [editingKey, setEditingKey] = useState<TContactAttributeKey | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const [deletingKey, setDeletingKey] = useState<TContactAttributeKey | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = (key: TContactAttributeKey) => {
    setEditingKey(key);
    setIsEditOpen(true);
  };

  const handleDelete = (key: TContactAttributeKey) => {
    setDeletingKey(key);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingKey) return;
    setIsDeleting(true);
    const result = await deleteAttributeKeyAction({ id: deletingKey.id, environmentId });
    setIsDeleting(false);

    if (result?.data?.success) {
      toast.success("Attribute key deleted successfully");
      setDeletingKey(null);
      setIsDeleteOpen(false);
      router.refresh();
    } else {
      toast.error(getFormattedErrorMessage(result));
      setIsDeleteOpen(false); // Close anyway?
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {t("environments.contacts.attributes.title")}
          </h2>
          <p className="text-sm text-slate-500">{t("environments.contacts.attributes.description")}</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          {t("environments.contacts.attributes.create_attribute_key")}
        </Button>
      </div>

      <AttributeKeysTable attributeKeys={attributeKeys} onEdit={handleEdit} onDelete={handleDelete} />

      <CreateAttributeKeyModal open={isCreateOpen} setOpen={setIsCreateOpen} environmentId={environmentId} />

      <EditAttributeKeyModal
        open={isEditOpen}
        setOpen={setIsEditOpen}
        environmentId={environmentId}
        attributeKey={editingKey}
      />

      <DeleteDialog
        open={isDeleteOpen}
        setOpen={setIsDeleteOpen}
        deleteWhat="attribute key"
        onDelete={confirmDelete}
        isDeleting={isDeleting}
        text={`Are you sure you want to delete the attribute key "${deletingKey?.key}"? This will delete all data associated with this key.`}
      />
    </div>
  );
};
