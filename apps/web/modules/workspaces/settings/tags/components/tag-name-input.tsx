"use client";

import { AlertCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Input } from "@/modules/ui/components/input";
import { useRenameTag } from "@/modules/workspaces/settings/tags/hooks/use-rename-tag";
import { TagError } from "@/modules/workspaces/settings/types/tag";

interface TagNameInputProps {
  tagId: string;
  tagName: string;
  workspaceId: string;
  isReadOnly: boolean;
}

/**
 * The tag column's cell. Split out of the old `SingleTag` row so the table can be driven by a column
 * config: the row's two interactive cells never shared state, so each now owns its own — this one holds
 * the rename error, the actions cell holds the merge and delete state.
 */
export const TagNameInput = ({ tagId, tagName, workspaceId, isReadOnly }: Readonly<TagNameInputProps>) => {
  const { t } = useTranslation();
  const [updateTagError, setUpdateTagError] = useState(false);
  const renameTag = useRenameTag(workspaceId);

  const handleUpdateTagName = async (event: React.FocusEvent<HTMLInputElement>) => {
    const name = event.target.value.trim();
    if (name === tagName) {
      // Blurring without editing is not a rename. Skipping the request also stops a tab-through from
      // firing one write per row.
      return;
    }

    try {
      await renameTag.mutateAsync({ tagId, name });
      setUpdateTagError(false);
      toast.success(t("workspace.tags.tag_updated"));
    } catch (error) {
      setUpdateTagError(true);
      const code = (error as { details?: { code?: string } }).details?.code;
      if (code === TagError.TAG_NAME_ALREADY_EXISTS) {
        toast.error(t("workspace.tags.tag_already_exists"), {
          duration: 2000,
          icon: <AlertCircleIcon className="size-5 text-orange-500" />,
        });
        return;
      }
      toast.error((error as Error).message ?? t("common.something_went_wrong_please_try_again"));
    }
  };

  return (
    <Input
      // Disabled while the rename is in flight, which is what serializes it: a second blur could
      // otherwise start a request that completes out of order and leave the earlier name in storage.
      disabled={isReadOnly || renameTag.isPending}
      aria-label={t("workspace.tags.tag")}
      className={cn(
        "w-full border font-medium text-slate-900",
        updateTagError ? "border-red-500 focus:border-red-500" : "border-slate-200 focus:border-slate-500"
      )}
      defaultValue={tagName}
      onBlur={handleUpdateTagName}
    />
  );
};
