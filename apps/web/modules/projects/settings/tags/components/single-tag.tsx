"use client";

import { cn } from "@/lib/cn";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  deleteTagAction,
  mergeTagsAction,
  updateTagNameAction,
} from "@/modules/projects/settings/tags/actions";
import { MergeTagsCombobox } from "@/modules/projects/settings/tags/components/merge-tags-combobox";
import { TagError } from "@/modules/projects/settings/types/tag";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { Input } from "@/modules/ui/components/input";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { useTranslate } from "@tolgee/react";
import { AlertCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { TTag } from "@formbricks/types/tags";

interface SingleTagProps {
  tagId: string;
  tagName: string;
  tagCount?: number;
  tagCountLoading?: boolean;
  updateTagsCount?: () => void;
  environmentTags: TTag[];
  isReadOnly?: boolean;
}

export const SingleTag: React.FC<SingleTagProps> = ({
  tagId,
  tagName,
  tagCount = 0,
  tagCountLoading = false,
  updateTagsCount = () => {},
  environmentTags,
  isReadOnly = false,
}) => {
  const { t } = useTranslate();
  const router = useRouter();
  const [updateTagError, setUpdateTagError] = useState(false);
  const [isMergingTags, setIsMergingTags] = useState(false);
  const [openDeleteTagDialog, setOpenDeleteTagDialog] = useState(false);

  const confirmDeleteTag = async () => {
    const deleteTagResponse = await deleteTagAction({ tagId });
    if (deleteTagResponse?.data) {
      if (deleteTagResponse.data.ok) {
        toast.success(t("environments.project.tags.tag_deleted"));
        updateTagsCount();
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

  const handleUpdateTagName = async (e: React.FocusEvent<HTMLInputElement>) => {
    const result = await updateTagNameAction({ tagId, name: e.target.value.trim() });
    if (result?.data) {
      if (result.data.ok) {
        setUpdateTagError(false);
        toast.success(t("environments.project.tags.tag_updated"));
      } else if (result.data?.error?.code === TagError.TAG_NAME_ALREADY_EXISTS) {
        toast.error(t("environments.project.tags.tag_already_exists"), {
          duration: 2000,
          icon: <AlertCircleIcon className="h-5 w-5 text-orange-500" />,
        });
        setUpdateTagError(true);
      } else {
        const errorMessage = result.data?.error?.message;
        toast.error(errorMessage);
        setUpdateTagError(true);
      }
    } else {
      const errorMessage = getFormattedErrorMessage(result);
      toast.error(errorMessage ?? t("common.something_went_wrong_please_try_again"));
      setUpdateTagError(true);
    }
  };

  const handleMergeTags = async (newTagId: string) => {
    setIsMergingTags(true);
    const mergeTagsResponse = await mergeTagsAction({ originalTagId: tagId, newTagId });

    if (mergeTagsResponse?.data) {
      if (mergeTagsResponse.data.ok) {
        toast.success(t("environments.project.tags.tags_merged"));
        updateTagsCount();
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
    <div className="w-full" key={tagId}>
      <div className="grid h-16 grid-cols-4 content-center rounded-lg">
        <div className="col-span-2 flex items-center text-sm">
          <div className="w-full text-left">
            <Input
              disabled={isReadOnly}
              className={cn(
                "w-full border font-medium text-slate-900",
                updateTagError
                  ? "border-red-500 focus:border-red-500"
                  : "border-slate-200 focus:border-slate-500"
              )}
              defaultValue={tagName}
              onBlur={handleUpdateTagName}
            />
          </div>
        </div>

        <div className="col-span-1 my-auto whitespace-nowrap text-center text-sm text-slate-500">
          <div className="text-slate-900">{tagCountLoading ? <LoadingSpinner /> : <p>{tagCount}</p>}</div>
        </div>

        {!isReadOnly && (
          <div className="col-span-1 my-auto flex items-center justify-center gap-2 whitespace-nowrap text-center text-sm text-slate-500">
            <div>
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
            </div>

            <div>
              <Button
                variant="destructive"
                size="sm"
                className="font-medium text-slate-50 focus:border-transparent focus:shadow-transparent focus:outline-transparent focus:ring-0 focus:ring-transparent"
                onClick={() => setOpenDeleteTagDialog(true)}>
                {t("common.delete")}
              </Button>
              <DeleteDialog
                open={openDeleteTagDialog}
                setOpen={setOpenDeleteTagDialog}
                deleteWhat={tagName}
                text={t("environments.project.tags.delete_tag_confirmation")}
                onDelete={confirmDeleteTag}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
