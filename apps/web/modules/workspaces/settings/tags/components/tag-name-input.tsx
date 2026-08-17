"use client";

import { AlertCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Input } from "@/modules/ui/components/input";
import { updateTagNameAction } from "@/modules/workspaces/settings/tags/actions";
import { TagError } from "@/modules/workspaces/settings/types/tag";

interface TagNameInputProps {
  tagId: string;
  tagName: string;
  isReadOnly: boolean;
}

/**
 * The tag column's cell. Split out of the old `SingleTag` row so the table can be driven by a column
 * config: the row's two interactive cells never shared state, so each now owns its own — this one holds
 * the rename error, the actions cell holds the merge and delete state.
 */
export const TagNameInput = ({ tagId, tagName, isReadOnly }: Readonly<TagNameInputProps>) => {
  const { t } = useTranslation();
  const [updateTagError, setUpdateTagError] = useState(false);

  const handleUpdateTagName = async (e: React.FocusEvent<HTMLInputElement>) => {
    const result = await updateTagNameAction({ tagId, name: e.target.value.trim() });
    if (result?.data) {
      if (result.data.ok) {
        setUpdateTagError(false);
        toast.success(t("workspace.tags.tag_updated"));
      } else if (result.data?.error?.code === TagError.TAG_NAME_ALREADY_EXISTS) {
        toast.error(t("workspace.tags.tag_already_exists"), {
          duration: 2000,
          icon: <AlertCircleIcon className="size-5 text-orange-500" />,
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

  return (
    <Input
      disabled={isReadOnly}
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
