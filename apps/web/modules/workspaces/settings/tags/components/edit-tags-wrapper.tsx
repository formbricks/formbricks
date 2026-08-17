"use client";

import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { TTag, TTagsCount } from "@formbricks/types/tags";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import { TagNameInput } from "@/modules/workspaces/settings/tags/components/tag-name-input";
import { TagRowActions } from "@/modules/workspaces/settings/tags/components/tag-row-actions";

interface EditTagsWrapperProps {
  environmentTags: TTag[];
  environmentTagsCount: TTagsCount;
  isReadOnly: boolean;
}

/**
 * Exported so `loading.tsx` builds its skeleton from the same array. That skeleton used to hand-roll the
 * header and had already drifted: it rendered the actions column unconditionally while the real table
 * gates it on `!isReadOnly`, so a read-only viewer saw a three-column skeleton resolve into a two-column
 * table.
 *
 * Defined at module level rather than inside the component: an inline `cell` that returns JSX reads as a
 * nested component definition to Sonar (typescript:S6478).
 */
export const getTagColumns = ({
  t,
  environmentTags,
  tagCountByTagId,
  isReadOnly,
}: Readonly<{
  t: TFunction;
  environmentTags: TTag[];
  tagCountByTagId: Map<string, number>;
  isReadOnly: boolean;
}>): TSettingsTableColumn<TTag>[] => {
  const columns: TSettingsTableColumn<TTag>[] = [
    {
      id: "tag",
      header: t("workspace.tags.tag"),
      headerClassName: "w-[50%]",
      skeletonWidth: "w-full",
      cell: (tag) => <TagNameInput tagId={tag.id} tagName={tag.name} isReadOnly={isReadOnly} />,
    },
    {
      id: "count",
      header: t("workspace.tags.count"),
      headerClassName: "w-[15%]",
      align: "center",
      cellClassName: "whitespace-nowrap text-slate-900",
      skeletonWidth: "w-8",
      cell: (tag) => tagCountByTagId.get(tag.id) ?? 0,
    },
  ];

  if (!isReadOnly) {
    columns.push({
      id: "actions",
      header: t("common.actions"),
      headerClassName: "w-[35%]",
      align: "center",
      skeletonWidth: "w-40",
      cell: (tag) => <TagRowActions tagId={tag.id} tagName={tag.name} environmentTags={environmentTags} />,
    });
  }

  return columns;
};

export const EditTagsWrapper = ({
  environmentTags,
  environmentTagsCount,
  isReadOnly,
}: Readonly<EditTagsWrapperProps>) => {
  const { t } = useTranslation();

  // One lookup instead of a `.find()` per row, which was O(tags × counts).
  const tagCountByTagId = new Map(environmentTagsCount?.map((count) => [count.tagId, count.count]) ?? []);

  return (
    <SettingsTable
      columns={getTagColumns({ t, environmentTags, tagCountByTagId, isReadOnly })}
      rows={environmentTags ?? []}
      getRowId={(tag) => tag.id}
      emptyMessage={t("workspace.tags.no_tag_found")}
      aria-label={t("common.tags")}
    />
  );
};
