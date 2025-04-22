"use client";

import { deleteIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import { timeSince } from "@/lib/time";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { EmptySpaceFiller } from "@/modules/ui/components/empty-space-filler";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { RefreshCcwIcon, Trash2Icon } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationNotion, TIntegrationNotionConfigData } from "@formbricks/types/integration/notion";
import { TUserLocale } from "@formbricks/types/user";

interface ManageIntegrationProps {
  environment: TEnvironment;
  notionIntegration: TIntegrationNotion;
  setOpenAddIntegrationModal: React.Dispatch<React.SetStateAction<boolean>>;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedIntegration: React.Dispatch<
    React.SetStateAction<(TIntegrationNotionConfigData & { index: number }) | null>
  >;
  locale: TUserLocale;
  handleNotionAuthorization: () => void;
}

export const ManageIntegration = ({
  environment,
  notionIntegration,
  setOpenAddIntegrationModal,
  setIsConnected,
  setSelectedIntegration,
  locale,
  handleNotionAuthorization,
}: ManageIntegrationProps) => {
  const { t } = useTranslate();
  const [isDeleteIntegrationModalOpen, setIsDeleteIntegrationModalOpen] = useState(false);
  const [isDeleting, setisDeleting] = useState(false);
  const integrationArray = notionIntegration
    ? notionIntegration.config.data
      ? notionIntegration.config.data
      : []
    : [];

  const handleDeleteIntegration = async () => {
    setisDeleting(true);

    const deleteIntegrationActionResult = await deleteIntegrationAction({
      integrationId: notionIntegration.id,
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
    setSelectedIntegration({ ...notionIntegration.config.data[index], index });
    setOpenAddIntegrationModal(true);
  };

  return (
    <div className="mt-6 flex w-full flex-col items-center justify-center p-6">
      <div className="flex w-full justify-end space-x-2">
        <div className="mr-6 flex items-center">
          <span className="mr-4 h-4 w-4 rounded-full bg-green-600"></span>
          <span className="text-slate-500">
            {t("environments.integrations.notion.connected_with_workspace", {
              workspace: notionIntegration.config.key.workspace_name,
            })}
          </span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={handleNotionAuthorization}>
                <RefreshCcwIcon className="mr-2 h-4 w-4" />
                {t("environments.integrations.notion.update_connection")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("environments.integrations.notion.update_connection_tooltip")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          onClick={() => {
            setSelectedIntegration(null);
            setOpenAddIntegrationModal(true);
          }}>
          {t("environments.integrations.notion.link_new_database")}
        </Button>
      </div>
      {!integrationArray || integrationArray.length === 0 ? (
        <div className="mt-4 w-full">
          <EmptySpaceFiller
            type="table"
            environment={environment}
            noWidgetRequired={true}
            emptyMessage={t("environments.integrations.notion.no_databases_found")}
          />
        </div>
      ) : (
        <div className="mt-4 flex w-full flex-col items-center justify-center">
          <div className="mt-6 w-full rounded-lg border border-slate-200">
            <div className="grid h-12 grid-cols-6 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
              <div className="col-span-2 hidden text-center sm:block">{t("common.survey")}</div>
              <div className="col-span-2 hidden text-center sm:block">
                {t("environments.integrations.notion.database_name")}
              </div>
              <div className="col-span-2 hidden text-center sm:block">{t("common.updated_at")}</div>
            </div>
            {integrationArray &&
              integrationArray.map((data, index) => {
                return (
                  <div
                    key={index}
                    className="m-2 grid h-16 cursor-pointer grid-cols-6 content-center rounded-lg hover:bg-slate-100"
                    onClick={() => {
                      editIntegration(index);
                    }}>
                    <div className="col-span-2 text-center">{data.surveyName}</div>
                    <div className="col-span-2 text-center">{data.databaseName}</div>
                    <div className="col-span-2 text-center">
                      {timeSince(data.createdAt.toString(), locale)}
                    </div>
                  </div>
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
        deleteWhat={t("environments.integrations.notion.notion_integration")}
        onDelete={handleDeleteIntegration}
        text={t("environments.integrations.delete_integration_confirmation")}
        isDeleting={isDeleting}
      />
    </div>
  );
};
