"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  deleteTagAction,
  mergeTagsAction,
  updateTagNameAction,
} from "@/modules/projects/settings/tags/actions";
import { MergeTagsCombobox } from "@/modules/projects/settings/tags/components/merge-tags-combobox";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { Input } from "@/modules/ui/components/input";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { useTranslate } from "@tolgee/react";
import { AlertCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { cn } from "@formbricks/lib/cn";
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
      toast.success(t("environments.project.tags.tag_deleted"));
      updateTagsCount();
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(deleteTagResponse);
      toast.error(errorMessage ?? t("common.something_went_wrong_please_try_again"));
    }
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
              onBlur={(e) => {
                updateTagNameAction({ tagId, name: e.target.value.trim() }).then((updateTagNameResponse) => {
                  if (updateTagNameResponse?.data) {
                    setUpdateTagError(false);
                    toast.success(t("environments.project.tags.tag_updated"));
                  } else {
                    const errorMessage = getFormattedErrorMessage(updateTagNameResponse);
                    if (
                      errorMessage.includes(
                        t("environments.project.tags.unique_constraint_failed_on_the_fields")
                      )
                    ) {
                      toast.error(t("environments.project.tags.tag_already_exists"), {
                        duration: 2000,
                        icon: <AlertCircleIcon className="h-5 w-5 text-orange-500" />,
                      });
                    } else {
                      toast.error(errorMessage ?? t("common.something_went_wrong_please_try_again"), {
                        duration: 2000,
                      });
                    }
                    setUpdateTagError(true);
                  }
                });
              }}
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
                  onSelect={(newTagId) => {
                    setIsMergingTags(true);
                    mergeTagsAction({ originalTagId: tagId, newTagId }).then((mergeTagsResponse) => {
                      if (mergeTagsResponse?.data) {
                        toast.success(t("environments.project.tags.tags_merged"));
                        updateTagsCount();
                        router.refresh();
                      } else {
                        const errorMessage = getFormattedErrorMessage(mergeTagsResponse);
                        toast.error(errorMessage ?? t("common.something_went_wrong_please_try_again"));
                      }
                      setIsMergingTags(false);
                    });
                  }}
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
