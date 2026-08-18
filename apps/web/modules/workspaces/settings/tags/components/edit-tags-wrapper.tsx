"use client";

import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { TV3Tag } from "@/app/api/v3/tags/serializers";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import { TagNameInput } from "@/modules/workspaces/settings/tags/components/tag-name-input";
import { TagRowActions } from "@/modules/workspaces/settings/tags/components/tag-row-actions";
import { useTags } from "@/modules/workspaces/settings/tags/hooks/use-tags";

interface EditTagsWrapperProps {
  workspaceId: string;
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
  workspaceId,
  tags,
  isReadOnly,
}: Readonly<{
  t: TFunction;
  workspaceId: string;
  tags: TV3Tag[];
  isReadOnly: boolean;
}>): TSettingsTableColumn<TV3Tag>[] => {
  const columns: TSettingsTableColumn<TV3Tag>[] = [
    {
      id: "tag",
      header: t("workspace.tags.tag"),
      headerClassName: "w-[50%]",
      skeletonWidth: "w-full",
      cell: (tag) => (
        <TagNameInput tagId={tag.id} tagName={tag.name} workspaceId={workspaceId} isReadOnly={isReadOnly} />
      ),
    },
    {
      id: "count",
      header: t("workspace.tags.count"),
      headerClassName: "w-[15%]",
      align: "center",
      cellClassName: "whitespace-nowrap text-slate-900",
      skeletonWidth: "w-8",
      cell: (tag) => tag.count,
    },
  ];

  if (!isReadOnly) {
    columns.push({
      id: "actions",
      header: t("common.actions"),
      headerClassName: "w-[35%]",
      align: "center",
      skeletonWidth: "w-40",
      cell: (tag) => (
        <TagRowActions
          tagId={tag.id}
          tagName={tag.name}
          workspaceId={workspaceId}
          mergeableTags={tags
            .filter((candidate) => candidate.id !== tag.id)
            .map((candidate) => ({ label: candidate.name, value: candidate.id }))}
        />
      ),
    });
  }

  return columns;
};

export const EditTagsWrapper = ({ workspaceId, isReadOnly }: Readonly<EditTagsWrapperProps>) => {
  const { t } = useTranslation();
  // The tag list lives in the query cache, so a rename, merge or delete invalidates it instead of
  // calling `router.refresh()` to revalidate the whole route.
  const { data: tags = [], isPending } = useTags(workspaceId);

  return (
    <SettingsTable
      columns={getTagColumns({ t, workspaceId, tags, isReadOnly })}
      rows={tags}
      getRowId={(tag) => tag.id}
      isLoading={isPending}
      emptyMessage={t("workspace.tags.no_tag_found")}
      aria-label={t("common.tags")}
    />
  );
};
