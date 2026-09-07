"use client";

import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { SettingsTableSkeleton } from "@/modules/ui/components/settings-table";
import { getTagColumns } from "@/modules/workspaces/settings/tags/components/edit-tags-wrapper";

export const TagsLoading = () => {
  const { t } = useTranslation();
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.tags")} />
      <SettingsCard
        title={t("workspace.tags.manage_tags")}
        description={t("workspace.tags.manage_tags_description")}
        bodyVariant="flush">
        {/*
          Columns come from the table's own factory, so the skeleton cannot drift from the header the way
          the hand-rolled one had.

          `isReadOnly: false` is a genuine limitation rather than a choice: a route `loading.tsx` receives
          no props and has no auth context, so it cannot know whether the actions column will be there. It
          renders the editor's three columns, which is the common case. The widths do not rely on summing
          to exactly 100% — `table-auto` rescales the rest when a column is absent.

          `workspaceId` and `tags` are never read: the skeleton renders headers and placeholder bars, and
          never calls `cell`.
        */}
        <SettingsTableSkeleton columns={getTagColumns({ t, workspaceId: "", tags: [], isReadOnly: false })} />
      </SettingsCard>
    </PageContentWrapper>
  );
};
