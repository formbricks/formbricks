"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useContactDirectories } from "../hooks/use-contact-directories";
import { ContactDirectoriesTable } from "./contact-directories-table";
import { ContactDirectoryDialog } from "./contact-directory-dialog";

/** Which dialog is open. Holds the directory's id only: the directory itself stays in the query cache. */
type TOpenDialog = { kind: "create" } | { kind: "manage"; directoryId: string } | null;

export const ContactDirectoriesView = ({ organizationId }: Readonly<{ organizationId: string }>) => {
  const { t } = useTranslation();
  const { data, error, isError, isLoading, refetch } = useContactDirectories({ organizationId });
  const [openDialog, setOpenDialog] = useState<TOpenDialog>(null);

  const managedDirectory =
    openDialog?.kind === "manage"
      ? data?.directories.find((directory) => directory.id === openDialog.directoryId)
      : undefined;

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={t("workspace.settings.contact_directories.title")}
        cta={
          <Button size="sm" disabled={!data} onClick={() => setOpenDialog({ kind: "create" })}>
            <PlusIcon aria-hidden="true" />
            {t("workspace.settings.contact_directories.create_directory")}
          </Button>
        }
      />

      {isError ? (
        <Alert variant="error">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            {getV3ApiErrorMessage(error, t("workspace.settings.contact_directories.load_failed"))}
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              {t("common.try_again")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <ContactDirectoriesTable
          directories={data?.directories ?? []}
          isLoading={isLoading}
          onManage={(directory) => setOpenDialog({ kind: "manage", directoryId: directory.id })}
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
    </PageContentWrapper>
  );
};
