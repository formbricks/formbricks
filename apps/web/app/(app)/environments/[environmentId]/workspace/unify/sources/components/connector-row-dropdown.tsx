"use client";

import {
  CopyIcon,
  FileSpreadsheetIcon,
  MoreVertical,
  PauseIcon,
  PlayIcon,
  SquarePenIcon,
  TrashIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TConnectorWithMappings } from "@formbricks/types/connector";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { CsvImportSection } from "./csv-import-section";

interface ConnectorRowDropdownProps {
  connector: TConnectorWithMappings;
  onEdit: () => void;
  onDuplicate: () => Promise<void>;
  onToggleStatus: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function ConnectorRowDropdown({
  connector,
  onEdit,
  onDuplicate,
  onToggleStatus,
  onDelete,
}: ConnectorRowDropdownProps) {
  const { t } = useTranslation();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCsvImportDialogOpen, setIsCsvImportDialogOpen] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isActive = connector.status === "active";

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <div // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      data-testid="connector-row-dropdown">
      <DropdownMenu open={isDropDownOpen} onOpenChange={setIsDropDownOpen}>
        <DropdownMenuTrigger className="z-10" asChild>
          <div className="cursor-pointer rounded-lg border bg-white p-2 hover:bg-slate-50">
            <span className="sr-only">{t("environments.surveys.open_options")}</span>
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="inline-block w-auto min-w-max">
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <button
                type="button"
                className="flex w-full items-center"
                onClick={(e) => {
                  e.preventDefault();
                  setIsDropDownOpen(false);
                  onEdit();
                }}>
                <SquarePenIcon className="mr-2 h-4 w-4" />
                {t("common.edit")}
              </button>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <button
                type="button"
                className="flex w-full items-center"
                onClick={async (e) => {
                  e.preventDefault();
                  setIsDropDownOpen(false);
                  await onDuplicate();
                }}>
                <CopyIcon className="mr-2 h-4 w-4" />
                {t("common.duplicate")}
              </button>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <button
                type="button"
                className="flex w-full items-center"
                onClick={async (e) => {
                  e.preventDefault();
                  setIsDropDownOpen(false);
                  await onToggleStatus();
                }}>
                {isActive ? <PauseIcon className="mr-2 h-4 w-4" /> : <PlayIcon className="mr-2 h-4 w-4" />}
                {isActive ? t("common.disable") : t("common.enable")}
              </button>
            </DropdownMenuItem>

            {connector.type === "csv" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <button
                    type="button"
                    className="flex w-full items-center"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsDropDownOpen(false);
                      setIsCsvImportDialogOpen(true);
                    }}>
                    <FileSpreadsheetIcon className="mr-2 h-4 w-4" />
                    {t("environments.unify.import_csv_data")}
                  </button>
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuItem>
              <button
                type="button"
                className="flex w-full items-center"
                onClick={(e) => {
                  e.preventDefault();
                  setIsDropDownOpen(false);
                  setIsDeleteDialogOpen(true);
                }}>
                <TrashIcon className="mr-2 h-4 w-4" />
                {t("common.delete")}
              </button>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteDialog
        deleteWhat={t("environments.unify.source")}
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      />

      {connector.type === "csv" && (
        <Dialog open={isCsvImportDialogOpen} onOpenChange={setIsCsvImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("environments.unify.import_csv_data")}</DialogTitle>
              <DialogDescription>{t("environments.unify.upload_csv_data_description")}</DialogDescription>
            </DialogHeader>
            <CsvImportSection
              connectorId={connector.id}
              environmentId={connector.environmentId}
              onImportComplete={() => setIsCsvImportDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
