"use client";

import { Loader2Icon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { CsvImportHandle, CsvImportSection, CsvImportState } from "./csv-import-section";

interface CsvImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectorId: string;
  environmentId: string;
  onOpenEditConnector?: () => void;
}

export function CsvImportModal({
  open,
  onOpenChange,
  connectorId,
  environmentId,
  onOpenEditConnector,
}: CsvImportModalProps) {
  const { t } = useTranslation();
  const importHandleRef = useRef<CsvImportHandle | null>(null);
  const [importState, setImportState] = useState<CsvImportState>({
    rowCount: 0,
    isImporting: false,
    hasData: false,
  });

  const handleStateChange = useCallback((state: CsvImportState) => {
    setImportState(state);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("environments.unify.import_csv_data")}</DialogTitle>
          <DialogDescription>{t("environments.unify.upload_csv_data_description")}</DialogDescription>
        </DialogHeader>
        <CsvImportSection
          connectorId={connectorId}
          environmentId={environmentId}
          onImportComplete={() => onOpenChange(false)}
          onStateChange={handleStateChange}
          handleRef={importHandleRef}
          renderFooter={false}
        />
        <DialogFooter>
          {onOpenEditConnector && (
            <Button
              variant="secondary"
              onClick={() => {
                onOpenChange(false);
                onOpenEditConnector();
              }}>
              {t("environments.unify.edit_csv_mapping")}
            </Button>
          )}
          <Button
            onClick={() => importHandleRef.current?.import()}
            disabled={!importState.hasData || importState.isImporting}>
            {importState.isImporting ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                {t("environments.unify.importing_data")}
              </>
            ) : (
              t("environments.unify.import_rows", { count: importState.rowCount })
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
