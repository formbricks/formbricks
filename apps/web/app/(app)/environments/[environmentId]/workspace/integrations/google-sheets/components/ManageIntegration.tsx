"use client";

import { RefreshCcwIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  TIntegrationGoogleSheets,
  TIntegrationGoogleSheetsConfigData,
} from "@formbricks/types/integration/google-sheet";
import { TUserLocale } from "@formbricks/types/user";
import { deleteIntegrationAction } from "@/app/(app)/environments/[environmentId]/workspace/integrations/actions";
import { timeSince } from "@/lib/time";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert, AlertButton, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface ManageIntegrationProps {
  googleSheetIntegration: TIntegrationGoogleSheets;
  setOpenAddIntegrationModal: (v: boolean) => void;
  setIsConnected: (v: boolean) => void;
  setSelectedIntegration: (v: (TIntegrationGoogleSheetsConfigData & { index: number }) | null) => void;
  showReconnectButton: boolean;
  handleGoogleAuthorization: () => void;
  locale: TUserLocale;
}

export const ManageIntegration = ({
  googleSheetIntegration,
  setOpenAddIntegrationModal,
  setIsConnected,
  setSelectedIntegration,
  showReconnectButton,
  handleGoogleAuthorization,
  locale,
}: ManageIntegrationProps) => {
  const { t } = useTranslation();
  const [isDeleteIntegrationModalOpen, setIsDeleteIntegrationModalOpen] = useState(false);
  let integrationArray: TIntegrationGoogleSheetsConfigData[] = [];
  if (googleSheetIntegration?.config.data) {
    integrationArray = googleSheetIntegration.config.data;
  }
  const [isDeleting, setisDeleting] = useState(false);

  const handleDeleteIntegration = async () => {
    setisDeleting(true);

    const deleteIntegrationActionResult = await deleteIntegrationAction({
      integrationId: googleSheetIntegration.id,
    });

    if (deleteIntegrationActionResult?.data) {
      toast.success(t("environments.integrations.integration_removed_successfully"));
      setIsConnected(false);
    } else {
      const errorMessage = getFormattedErrorMessage(deleteIntegrationActionResult);
      toast.error(errorMessage);
    }

    setisDeleting(false);
    setIsDeleteIntegrationModalOpen(false);
  };

  const editIntegration = (index: number) => {
    setSelectedIntegration({
      ...googleSheetIntegration.config.data[index],
      index: index,
    });
    setOpenAddIntegrationModal(true);
  };

  return (
    <div className="mt-6 flex w-full flex-col items-center justify-center p-6">
      {showReconnectButton && (
        <Alert variant="warning" size="small" className="mb-4 w-full">
          <AlertDescription>
            {t("environments.integrations.google_sheets.reconnect_button_description")}
          </AlertDescription>
          <AlertButton onClick={handleGoogleAuthorization}>
            {t("environments.integrations.google_sheets.reconnect_button")}
          </AlertButton>
        </Alert>
      )}
      <div className="flex w-full justify-end space-x-2">
        <div className="mr-6 flex items-center">
          <span className="mr-4 h-4 w-4 rounded-full bg-green-600"></span>
          <span className="text-slate-500">
            {t("environments.integrations.connected_with_email", {
              email: googleSheetIntegration.config.email,
            })}
          </span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={handleGoogleAuthorization}>
                <RefreshCcwIcon className="mr-2 h-4 w-4" />
                {t("environments.integrations.google_sheets.reconnect_button")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t("environments.integrations.google_sheets.reconnect_button_tooltip")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          onClick={() => {
            setSelectedIntegration(null);
            setOpenAddIntegrationModal(true);
          }}>
          {t("environments.integrations.google_sheets.link_new_sheet")}
        </Button>
      </div>
      {!integrationArray || integrationArray.length === 0 ? (
        <div className="mt-4 w-full">
          <EmptyState text={t("environments.integrations.google_sheets.no_integrations_yet")} />
        </div>
      ) : (
        <div className="mt-4 flex w-full flex-col items-center justify-center">
          <div className="mt-6 w-full rounded-lg border border-slate-200">
            <div className="grid h-12 grid-cols-8 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
              <div className="col-span-2 hidden text-center sm:block">{t("common.survey")}</div>
              <div className="col-span-2 hidden text-center sm:block">
                {t("environments.integrations.google_sheets.google_sheet_name")}
              </div>
              <div className="col-span-2 hidden text-center sm:block">{t("common.questions")}</div>
              <div className="col-span-2 hidden text-center sm:block">{t("common.updated_at")}</div>
            </div>
            {integrationArray.map((data, index) => {
              return (
                <button
                  key={`${index}-${data.spreadsheetName}-${data.surveyName}`}
                  className="grid h-16 w-full cursor-pointer grid-cols-8 content-center rounded-lg p-2 hover:bg-slate-100"
                  onClick={() => {
                    editIntegration(index);
                  }}>
                  <div className="col-span-2 text-center">{data.surveyName}</div>
                  <div className="col-span-2 text-center">{data.spreadsheetName}</div>
                  <div className="col-span-2 text-center">{data.elements}</div>
                  <div className="col-span-2 text-center">{timeSince(data.createdAt.toString(), locale)}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <Button variant="ghost" onClick={() => setIsDeleteIntegrationModalOpen(true)} className="mt-4">
        <Trash2Icon />
        {t("environments.integrations.delete_integration")}
      </Button>

      <DeleteDialog
        open={isDeleteIntegrationModalOpen}
        setOpen={setIsDeleteIntegrationModalOpen}
        deleteWhat={t("environments.integrations.google_sheets.google_connection")}
        onDelete={handleDeleteIntegration}
        text={t("environments.integrations.google_sheets.google_connection_deletion_description")}
        isDeleting={isDeleting}
      />
    </div>
  );
};
