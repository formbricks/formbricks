"use client";

import { deleteIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import { timeSince } from "@/lib/time";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { useTranslate } from "@tolgee/react";
import { RefreshCcwIcon, Trash2Icon } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationNotion, TIntegrationNotionConfigData } from "@formbricks/types/integration/notion";
import { TUserLocale } from "@formbricks/types/user";
import { IntegrationListPanel } from "../../components/IntegrationListPanel";

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

  let integrationArray: TIntegrationNotionConfigData[] = [];
  if (notionIntegration?.config.data) {
    integrationArray = notionIntegration.config.data;
  }

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
    <>
      <IntegrationListPanel
        environment={environment}
        statusNode={
          <>
            <span className="mr-4 h-4 w-4 rounded-full bg-green-600"></span>
            <span className="text-slate-500">
              {t("environments.integrations.notion.connected_with_workspace", {
                workspace: notionIntegration.config.key.workspace_name,
              })}
            </span>
          </>
        }
        reconnectAction={{
          label: t("environments.integrations.notion.update_connection"),
          onClick: handleNotionAuthorization,
          icon: <RefreshCcwIcon className="mr-2 h-4 w-4" />,
          tooltip: t("environments.integrations.notion.update_connection_tooltip"),
          variant: "outline",
        }}
        addNewAction={{
          label: t("environments.integrations.notion.link_new_database"),
          onClick: () => {
            setSelectedIntegration(null);
            setOpenAddIntegrationModal(true);
          },
        }}
        emptyMessage={t("environments.integrations.notion.no_databases_found")}
        items={integrationArray}
        columns={[
          {
            header: t("common.survey"),
            render: (item: TIntegrationNotionConfigData) => item.surveyName,
          },
          {
            header: t("environments.integrations.notion.database_name"),
            render: (item: TIntegrationNotionConfigData) => item.databaseName,
          },
          {
            header: t("common.updated_at"),
            render: (item: TIntegrationNotionConfigData) => timeSince(item.createdAt.toString(), locale),
          },
        ]}
        onRowClick={editIntegration}
        getRowKey={(item: TIntegrationNotionConfigData, idx) => `${idx}-${item.databaseId}`}
      />
      <div className="mt-4 flex justify-center">
        <Button variant="ghost" onClick={() => setIsDeleteIntegrationModalOpen(true)}>
          <Trash2Icon />
          {t("environments.integrations.delete_integration")}
        </Button>
      </div>

      <DeleteDialog
        open={isDeleteIntegrationModalOpen}
        setOpen={setIsDeleteIntegrationModalOpen}
        deleteWhat={t("environments.integrations.notion.notion_integration")}
        onDelete={handleDeleteIntegration}
        text={t("environments.integrations.delete_integration_confirmation")}
        isDeleting={isDeleting}
      />
    </>
  );
};
