"use client";

import { deleteIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import { timeSince } from "@/lib/time";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { EmptySpaceFiller } from "@/modules/ui/components/empty-space-filler";
import { T, useTranslate } from "@tolgee/react";
import { Trash2Icon } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationSlack, TIntegrationSlackConfigData } from "@formbricks/types/integration/slack";
import { TUserLocale } from "@formbricks/types/user";

interface ManageIntegrationProps {
  environment: TEnvironment;
  slackIntegration: TIntegrationSlack;
  setOpenAddIntegrationModal: React.Dispatch<React.SetStateAction<boolean>>;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedIntegration: React.Dispatch<
    React.SetStateAction<(TIntegrationSlackConfigData & { index: number }) | null>
  >;
  refreshChannels: () => void;
  showReconnectButton: boolean;
  handleSlackAuthorization: () => void;
  locale: TUserLocale;
}

export const ManageIntegration = ({
  environment,
  slackIntegration,
  setOpenAddIntegrationModal,
  setIsConnected,
  setSelectedIntegration,
  refreshChannels,
  showReconnectButton,
  handleSlackAuthorization,
  locale,
}: ManageIntegrationProps) => {
  const { t } = useTranslate();
  const [isDeleteIntegrationModalOpen, setIsDeleteIntegrationModalOpen] = useState(false);
  const [isDeleting, setisDeleting] = useState(false);
  let integrationArray: TIntegrationSlackConfigData[] = [];
  if (slackIntegration && slackIntegration.config.data) {
    integrationArray = slackIntegration.config.data;
  }

  const handleDeleteIntegration = async () => {
    setisDeleting(true);

    const deleteIntegrationActionResult = await deleteIntegrationAction({
      integrationId: slackIntegration.id,
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
    setSelectedIntegration({ ...slackIntegration.config.data[index], index });
    setOpenAddIntegrationModal(true);
  };

  return (
    <div className="mt-6 flex w-full flex-col items-center justify-center p-6">
      {showReconnectButton && (
        <div className="mb-4 flex w-full items-center justify-between space-x-4">
          <p className="text-amber-700">
            <T
              keyName="environments.integrations.slack.slack_reconnect_button_description"
              params={{ b: <b /> }}
            />
          </p>
          <Button onClick={handleSlackAuthorization} variant="secondary">
            {t("environments.integrations.slack.slack_reconnect_button")}
          </Button>
        </div>
      )}
      <div className="flex w-full justify-end space-x-4">
        <div className="mr-6 flex items-center">
          <span className="mr-4 h-4 w-4 rounded-full bg-green-600"></span>
          <span className="text-slate-500">
            {t("environments.integrations.slack.connected_with_team", {
              team: slackIntegration.config.key.team?.name,
            })}
          </span>
        </div>
        <Button
          onClick={() => {
            refreshChannels();
            setSelectedIntegration(null);
            setOpenAddIntegrationModal(true);
          }}>
          {t("environments.integrations.slack.link_channel")}
        </Button>
      </div>
      {!integrationArray || integrationArray.length === 0 ? (
        <div className="mt-4 w-full">
          <EmptySpaceFiller
            type="table"
            environment={environment}
            noWidgetRequired={true}
            emptyMessage={t("environments.integrations.slack.connect_your_first_slack_channel")}
          />
        </div>
      ) : (
        <div className="mt-4 flex w-full flex-col items-center justify-center">
          <div className="mt-6 w-full rounded-lg border border-slate-200">
            <div className="grid h-12 grid-cols-8 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
              <div className="col-span-2 hidden text-center sm:block">{t("common.survey")}</div>
              <div className="col-span-2 hidden text-center sm:block">
                {t("environments.integrations.slack.channel_name")}
              </div>
              <div className="col-span-2 hidden text-center sm:block">{t("common.questions")}</div>
              <div className="col-span-2 hidden text-center sm:block">{t("common.updated_at")}</div>
            </div>
            {integrationArray &&
              integrationArray.map((data, index) => {
                return (
                  <button
                    key={`${index}-${data.surveyName}-${data.channelName}`}
                    className="grid h-16 w-full grid-cols-8 content-center rounded-lg p-2 text-slate-700 hover:cursor-pointer hover:bg-slate-100"
                    onClick={() => {
                      editIntegration(index);
                    }}>
                    <div className="col-span-2 text-center">{data.surveyName}</div>
                    <div className="col-span-2 text-center">{data.channelName}</div>
                    <div className="col-span-2 text-center">{data.questions}</div>
                    <div className="col-span-2 text-center">
                      {timeSince(data.createdAt.toString(), locale)}
                    </div>
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
        deleteWhat={t("environments.integrations.slack.slack_integration")}
        onDelete={handleDeleteIntegration}
        text={t("environments.integrations.delete_integration_confirmation")}
        isDeleting={isDeleting}
      />
    </div>
  );
};
