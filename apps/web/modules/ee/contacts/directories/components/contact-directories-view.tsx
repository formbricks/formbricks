"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";
import { useContactDirectories } from "../hooks/use-contact-directories";
import { getVisibleDirectories } from "../lib/display";
import { ContactDirectoriesTable } from "./contact-directories-table";
import { ContactDirectoryDialog } from "./contact-directory-dialog";

const SHOW_ARCHIVED_ID = "contact-directories-show-archived";

/** Which dialog is open. Holds the directory's id only: the directory itself stays in the query cache. */
type TOpenDialog = { kind: "create" } | { kind: "manage"; directoryId: string } | null;

export const ContactDirectoriesView = ({ organizationId }: Readonly<{ organizationId: string }>) => {
  const { t } = useTranslation();
  const { data, error, isError, isLoading, refetch } = useContactDirectories({ organizationId });
  const [openDialog, setOpenDialog] = useState<TOpenDialog>(null);
  const [showArchived, setShowArchived] = useState(false);

  const managedDirectory =
    openDialog?.kind === "manage"
      ? data?.directories.find((directory) => directory.id === openDialog.directoryId)
      : undefined;

  return (
    <SettingsCard
      title={t("workspace.settings.contact_directories.title")}
      description={t("workspace.settings.contact_directories.description")}
      bodyVariant="flush">
      {/* The table runs edge to edge, so the controls above it carry the card's gutter themselves. */}
      <div className="mb-4 flex items-center justify-between gap-2 px-4 pt-4">
        {/* As on the Feedback Datasets list: archived directories stay hidden unless asked for. */}
        <div className="flex items-center gap-2">
          {isError ? null : (
            <>
              <Switch id={SHOW_ARCHIVED_ID} checked={showArchived} onCheckedChange={setShowArchived} />
              <Label htmlFor={SHOW_ARCHIVED_ID} className="font-normal text-slate-500">
                {t("workspace.settings.contact_directories.show_archived")}
              </Label>
            </>
          )}
        </div>
        <Button size="sm" disabled={!data} onClick={() => setOpenDialog({ kind: "create" })}>
          <PlusIcon aria-hidden="true" />
          {t("workspace.settings.contact_directories.create_directory")}
        </Button>
      </div>

      {isError ? (
        <div className="px-4 pb-4">
          <Alert variant="error">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              {getV3ApiErrorMessage(error, t("workspace.settings.contact_directories.load_failed"))}
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                {t("common.try_again")}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <ContactDirectoriesTable
          directories={getVisibleDirectories(data?.directories ?? [], showArchived)}
          isLoading={isLoading}
          emptyMessage={
            !showArchived && data?.directories.some((directory) => directory.isArchived)
              ? t("workspace.settings.contact_directories.empty_state_archived_hidden")
              : t("workspace.settings.contact_directories.empty_state")
          }
          onManage={(directory) => setOpenDialog({ kind: "manage", directoryId: directory.id })}
          onUnarchive={(directory) => setOpenDialog({ kind: "manage", directoryId: directory.id })}
        />
      )}

      {data && (openDialog?.kind === "create" || managedDirectory) ? (
        <ContactDirectoryDialog
          key={managedDirectory?.id ?? "create"}
          organizationId={organizationId}
          list={data}
          directory={managedDirectory}
          onClose={() => setOpenDialog(null)}
        />
      ) : null}
    </SettingsCard>
  );
};
