"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TTag } from "@formbricks/types/tags";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { deleteTagAction, mergeTagsAction } from "@/modules/workspaces/settings/tags/actions";
import { MergeTagsCombobox } from "@/modules/workspaces/settings/tags/components/merge-tags-combobox";

interface TagRowActionsProps {
  tagId: string;
  tagName: string;
  environmentTags: TTag[];
}

/**
 * The actions column's cell — merge and delete. Split out of the old `SingleTag` row along with
 * `TagNameInput`; it owns the merge-in-flight and delete-dialog state that used to sit on the whole row.
 */
export const TagRowActions = ({ tagId, tagName, environmentTags }: Readonly<TagRowActionsProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isMergingTags, setIsMergingTags] = useState(false);
  const [openDeleteTagDialog, setOpenDeleteTagDialog] = useState(false);

  const confirmDeleteTag = async () => {
    const deleteTagResponse = await deleteTagAction({ tagId });
    if (deleteTagResponse?.data) {
      if (deleteTagResponse.data.ok) {
        toast.success(t("workspace.tags.tag_deleted"));
        router.refresh();
      } else {
        const errorMessage = deleteTagResponse.data?.error?.message;
        toast.error(errorMessage);
      }
    } else {
      const errorMessage = getFormattedErrorMessage(deleteTagResponse);
      toast.error(errorMessage ?? t("common.something_went_wrong_please_try_again"));
    }
  };

  const handleMergeTags = async (newTagId: string) => {
    setIsMergingTags(true);
    const mergeTagsResponse = await mergeTagsAction({ originalTagId: tagId, newTagId });

    if (mergeTagsResponse?.data) {
      if (mergeTagsResponse.data.ok) {
        toast.success(t("workspace.tags.tags_merged"));
        router.refresh();
      } else {
        const errorMessage = mergeTagsResponse.data?.error?.message;
        toast.error(errorMessage ?? t("common.something_went_wrong_please_try_again"));
      }
    } else {
      const errorMessage = getFormattedErrorMessage(mergeTagsResponse);
      toast.error(errorMessage ?? t("common.something_went_wrong_please_try_again"));
    }
    setIsMergingTags(false);
  };

  return (
    // The flex sits here rather than on `cellClassName`, which would land on the `<td>` and stop it being
    // a table cell.
    <div className="flex items-center justify-center gap-2">
      {isMergingTags ? (
        <div className="w-24">
          <LoadingSpinner />
        </div>
      ) : (
        <MergeTagsCombobox
          tags={
            environmentTags
              ?.filter((tag) => tag.id !== tagId)
              ?.map((tag) => ({ label: tag.name, value: tag.id })) ?? []
          }
          onSelect={handleMergeTags}
        />
      )}
      <Button
        variant="destructive"
        size="sm"
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
      />
    </div>
  );
};
