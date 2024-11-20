"use client";

import { deleteIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { timeSince } from "@formbricks/lib/time";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationSlack, TIntegrationSlackConfigData } from "@formbricks/types/integration/slack";
import { TUserLocale } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/components/Button";
import { DeleteDialog } from "@formbricks/ui/components/DeleteDialog";
import { EmptySpaceFiller } from "@formbricks/ui/components/EmptySpaceFiller";

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
  const t = useTranslations();
  const [isDeleteIntegrationModalOpen, setIsDeleteIntegrationModalOpen] = useState(false);
  const [isDeleting, setisDeleting] = useState(false);
  const integrationArray = slackIntegration
    ? slackIntegration.config.data
      ? slackIntegration.config.data
      : []
    : [];

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
            {t.rich("environments.integrations.slack.slack_reconnect_button_description", {
              b: (chunks) => <b>{chunks}</b>,
            })}
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
                  <div
                    key={index}
                    className="m-2 grid h-16 grid-cols-8 content-center rounded-lg text-slate-700 hover:cursor-pointer hover:bg-slate-100"
                    onClick={() => {
                      editIntegration(index);
                    }}>
                    <div className="col-span-2 text-center">{data.surveyName}</div>
                    <div className="col-span-2 text-center">{data.channelName}</div>
                    <div className="col-span-2 text-center">{data.questions}</div>
                    <div className="col-span-2 text-center">
                      {timeSince(data.createdAt.toString(), locale)}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
      <Button
        variant="minimal"
        onClick={() => setIsDeleteIntegrationModalOpen(true)}
        className="mt-4"
        StartIcon={Trash2Icon}
        startIconClassName="h-5 w-5 mr-2">
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
