"use client";

import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { TV3Tag } from "@/app/api/v3/tags/serializers";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
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
  const { data: tags = [], isPending, isError, error, refetch } = useTags(workspaceId);

  // A failed fetch must not fall through to the table: `data` defaults to `[]`, so the empty state would
  // claim the workspace has no tags when the request merely failed. Same shape as `survey-list.tsx` and
  // `workflow-runs-table.tsx`.
  if (isError && tags.length === 0) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 py-16 text-slate-600">
        <p>{getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))}</p>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          {t("common.try_again")}
        </Button>
      </div>
    );
  }

  return (
    <SettingsTable
      columns={getTagColumns({ t, workspaceId, tags, isReadOnly })}
      rows={tags}
      getRowId={(tag) => tag.id}
      // Keyed by the id the API returned, so `settings-tags.spec.ts` can address a row without matching
      // on the name — the one thing a rename changes.
      getRowProps={(tag) => ({ "data-testid": `tag-row-${tag.id}` })}
      isLoading={isPending}
      emptyMessage={t("workspace.tags.no_tag_found")}
      aria-label={t("common.tags")}
    />
  );
};
