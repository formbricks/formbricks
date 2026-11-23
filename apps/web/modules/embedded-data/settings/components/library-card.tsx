"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import type { TEmbeddedDataListItemResource } from "@/app/api/internal/embedded-data/serializers";
import { useEmbeddedDataLibrary } from "@/modules/embedded-data/hooks/use-embedded-data";
import { Button } from "@/modules/ui/components/button";
import { SettingsTable } from "@/modules/ui/components/settings-table";
import { DeleteFieldDialog } from "./delete-field-dialog";
import { getLibraryColumns } from "./library-columns";
import { LibraryFieldModal } from "./library-field-modal";

interface LibraryCardProps {
  workspaceId: string;
  isReadOnly: boolean;
  /** App locale — the edit dialog's created-on line and date default picker format against it. */
  locale: string;
}

/**
 * The Library card: the workspace's shared Embedded Data fields, and the three dialogs that change
 * them.
 *
 * The rows are the library query, which the page fills on the server; every write goes through
 * `/api/internal/embedded-data` and refetches it. There is no other copy of the list to keep in step.
 */
export const LibraryCard = ({ workspaceId, isReadOnly, locale }: Readonly<LibraryCardProps>) => {
  const { t } = useTranslation();
  const { data: fields = [] } = useEmbeddedDataLibrary(workspaceId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingField, setEditingField] = useState<TEmbeddedDataListItemResource | null>(null);
  const [deletingField, setDeletingField] = useState<TEmbeddedDataListItemResource | null>(null);

  const newFieldButton = (
    <Button size="sm" onClick={() => setIsCreateOpen(true)}>
      {t("workspace.embedded_data.new_field")}
      <PlusIcon />
    </Button>
  );

  return (
    <>
      <SettingsCard
        title={t("workspace.embedded_data.library")}
        description={t("workspace.embedded_data.library_description")}
        bodyVariant="flush"
        cta={isReadOnly ? undefined : newFieldButton}>
        {/*
          Rendered whether or not there are rows: `SettingsTable` draws `emptyMessage` centred across
          its own columns, so the empty library keeps the table's header and hairline instead of a
          second card nested inside this one. It also means the header's `cta` is the only "New
          field" button on the page — an `EmptyState` with its own action put two there.
        */}
        <SettingsTable
          columns={getLibraryColumns({
            t,
            workspaceId,
            isReadOnly,
            onEdit: setEditingField,
            onDelete: setDeletingField,
          })}
          rows={fields}
          getRowId={(field) => field.id}
          getRowProps={(field) => ({ "data-testid": `embedded-data-row-${field.id}` })}
          emptyMessage={t("workspace.embedded_data.empty_state")}
          aria-label={t("workspace.embedded_data.library")}
          onRowClick={setEditingField}
          getRowLabel={(field) => field.name}
          // A read-only member sees every value but cannot open the edit dialog, so the row keeps
          // its plain text instead of becoming an activator button that leads nowhere.
          isRowClickable={() => !isReadOnly}
        />
      </SettingsCard>

      {isCreateOpen && (
        <LibraryFieldModal
          workspaceId={workspaceId}
          field={null}
          open={isCreateOpen}
          setOpen={setIsCreateOpen}
          locale={locale}
        />
      )}

      {editingField && (
        // Keyed by the row, so opening a different field remounts the form with that field's values
        // rather than keeping the first one's defaults.
        <LibraryFieldModal
          key={editingField.id}
          workspaceId={workspaceId}
          field={editingField}
          open={true}
          setOpen={(open) => {
            if (!open) setEditingField(null);
          }}
          locale={locale}
        />
      )}

      {deletingField && (
        <DeleteFieldDialog
          key={deletingField.id}
          field={deletingField}
          workspaceId={workspaceId}
          open={true}
          setOpen={(open) => {
            if (!open) setDeletingField(null);
          }}
        />
      )}
    </>
  );
};
