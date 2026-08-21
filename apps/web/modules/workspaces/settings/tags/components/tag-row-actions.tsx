"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { MergeTagsCombobox } from "@/modules/workspaces/settings/tags/components/merge-tags-combobox";
import { useDeleteTag } from "@/modules/workspaces/settings/tags/hooks/use-delete-tag";
import { useMergeTags } from "@/modules/workspaces/settings/tags/hooks/use-merge-tags";

interface TagRowActionsProps {
  tagId: string;
  tagName: string;
  workspaceId: string;
  mergeableTags: { label: string; value: string }[];
}

/**
 * The actions column's cell — merge and delete. Split out of the old `SingleTag` row along with
 * `TagNameInput`; it owns the merge-in-flight and delete-dialog state that used to sit on the whole row.
 */
export const TagRowActions = ({
  tagId,
  tagName,
  workspaceId,
  mergeableTags,
}: Readonly<TagRowActionsProps>) => {
  const { t } = useTranslation();
  const [openDeleteTagDialog, setOpenDeleteTagDialog] = useState(false);
  const deleteTag = useDeleteTag(workspaceId);
  const mergeTags = useMergeTags(workspaceId);

  const confirmDeleteTag = async () => {
    try {
      await deleteTag.mutateAsync({ tagId });
      toast.success(t("workspace.tags.tag_deleted"));
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    }
  };

  const handleMergeTags = async (newTagId: string) => {
    try {
      await mergeTags.mutateAsync({ tagId, newTagId });
      toast.success(t("workspace.tags.tags_merged"));
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    }
  };

  return (
    // The flex sits here rather than on `cellClassName`, which would land on the `<td>` and stop it being
    // a table cell.
    <div className="flex items-center justify-center gap-2">
      {mergeTags.isPending ? (
        <div className="w-24">
          <LoadingSpinner />
        </div>
      ) : (
        <MergeTagsCombobox tags={mergeableTags} onSelect={handleMergeTags} />
      )}
      <Button
        variant="destructive"
        size="sm"
        loading={deleteTag.isPending}
        className="font-medium text-slate-50 focus:border-transparent focus:ring-0 focus:shadow-transparent focus:ring-transparent focus:outline-transparent"
        onClick={() => setOpenDeleteTagDialog(true)}>
        {t("common.delete")}
      </Button>
      <DeleteDialog
        open={openDeleteTagDialog}
        setOpen={setOpenDeleteTagDialog}
        deleteWhat={tagName}
        text={t("workspace.tags.delete_tag_confirmation")}
        onDelete={confirmDeleteTag}
        isDeleting={deleteTag.isPending}
      />
    </div>
  );
};
