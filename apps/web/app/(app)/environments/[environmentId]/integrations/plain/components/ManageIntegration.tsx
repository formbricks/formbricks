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
import { TIntegrationPlain, TIntegrationPlainConfigData } from "@formbricks/types/integration/plain";
import { TUserLocale } from "@formbricks/types/user";
import { IntegrationListPanel } from "../../components/IntegrationListPanel";
import { AddKeyModal } from "./AddKeyModal";

interface ManageIntegrationProps {
  environment: TEnvironment;
  plainIntegration: TIntegrationPlain;
  setOpenAddIntegrationModal: React.Dispatch<React.SetStateAction<boolean>>;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedIntegration: React.Dispatch<
    React.SetStateAction<(TIntegrationPlainConfigData & { index: number }) | null>
  >;
  locale: TUserLocale;
}

export const ManageIntegration = ({
  environment,
  plainIntegration,
  setOpenAddIntegrationModal,
  setIsConnected,
  setSelectedIntegration,
  locale,
}: ManageIntegrationProps) => {
  const { t } = useTranslate();
  const [isDeleteIntegrationModalOpen, setIsDeleteIntegrationModalOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isDeleting, setisDeleting] = useState(false);

  let integrationArray: TIntegrationPlainConfigData[] = [];
  if (plainIntegration?.config.data) {
    integrationArray = plainIntegration.config.data;
  }

  const handleDeleteIntegration = async () => {
    setisDeleting(true);

    const deleteIntegrationActionResult = await deleteIntegrationAction({
      integrationId: plainIntegration.id,
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
    setSelectedIntegration({ ...plainIntegration.config.data[index], index });
    setOpenAddIntegrationModal(true);
  };

  return (
    <>
      <IntegrationListPanel
        environment={environment}
        statusNode={
          <>
            <span className="mr-4 h-4 w-4 rounded-full bg-green-600"></span>
            <span className="text-slate-500">{t("common.connected")}</span>
          </>
        }
        reconnectAction={{
          label: t("environments.integrations.plain.update_connection"),
          onClick: () => setIsKeyModalOpen(true),
          icon: <RefreshCcwIcon className="mr-2 h-4 w-4" />,
          tooltip: t("environments.integrations.plain.update_connection_tooltip"),
          variant: "outline",
        }}
        addNewAction={{
          label: t("environments.integrations.plain.link_new_database"),
          onClick: () => {
            setSelectedIntegration(null);
            setOpenAddIntegrationModal(true);
          },
        }}
        emptyMessage={t("environments.integrations.plain.no_databases_found")}
        items={integrationArray}
        columns={[
          {
            header: t("common.survey"),
            render: (item: TIntegrationPlainConfigData) => item.surveyName,
          },
          {
            header: t("common.survey_id"),
            render: (item: TIntegrationPlainConfigData) => item.surveyId,
          },
          {
            header: t("common.updated_at"),
            render: (item: TIntegrationPlainConfigData) => timeSince(item.createdAt.toString(), locale),
          },
        ]}
        onRowClick={editIntegration}
        getRowKey={(item: TIntegrationPlainConfigData, idx) => `${idx}-${item.surveyId}`}
      />
      <div className="mt-4 flex justify-center">
        <Button variant="ghost" onClick={() => setIsDeleteIntegrationModalOpen(true)}>
          <Trash2Icon />
          {t("environments.integrations.delete_integration")}
        </Button>
      </div>

      <AddKeyModal environmentId={environment.id} open={isKeyModalOpen} setOpen={setIsKeyModalOpen} />

      <DeleteDialog
        open={isDeleteIntegrationModalOpen}
        setOpen={setIsDeleteIntegrationModalOpen}
        deleteWhat={t("environments.integrations.plain.plain_integration")}
        onDelete={handleDeleteIntegration}
        text={t("environments.integrations.delete_integration_confirmation")}
        isDeleting={isDeleting}
      />
    </>
  );
};
