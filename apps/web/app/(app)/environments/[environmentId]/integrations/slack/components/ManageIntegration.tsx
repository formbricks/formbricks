"use client";

import { deleteIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import { Trash2Icon } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { timeSince } from "@formbricks/lib/time";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationSlack, TIntegrationSlackConfigData } from "@formbricks/types/integration/slack";
import { Button } from "@formbricks/ui/Button";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import { EmptySpaceFiller } from "@formbricks/ui/EmptySpaceFiller";

interface ManageIntegrationProps {
  environment: TEnvironment;
  slackIntegration: TIntegrationSlack;
  setOpenAddIntegrationModal: React.Dispatch<React.SetStateAction<boolean>>;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedIntegration: React.Dispatch<
    React.SetStateAction<(TIntegrationSlackConfigData & { index: number }) | null>
  >;
  refreshChannels: () => void;
}

export const ManageIntegration = ({
  environment,
  slackIntegration,
  setOpenAddIntegrationModal,
  setIsConnected,
  setSelectedIntegration,
  refreshChannels,
}: ManageIntegrationProps) => {
  const [isDeleteIntegrationModalOpen, setIsDeleteIntegrationModalOpen] = useState(false);
  const [isDeleting, setisDeleting] = useState(false);
  const integrationArray = slackIntegration
    ? slackIntegration.config.data
      ? slackIntegration.config.data
      : []
    : [];

  const handleDeleteIntegration = async () => {
    try {
      setisDeleting(true);
      await deleteIntegrationAction({ integrationId: slackIntegration.id });
      setIsConnected(false);
      toast.success("Integration removed successfully");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setisDeleting(false);
      setIsDeleteIntegrationModalOpen(false);
    }
  };

  const editIntegration = (index: number) => {
    setSelectedIntegration({ ...slackIntegration.config.data[index], index });
    setOpenAddIntegrationModal(true);
  };

  return (
    <div className="mt-6 flex w-full flex-col items-center justify-center p-6">
      <div className="flex w-full justify-end">
        <div className="mr-6 flex items-center">
          <span className="mr-4 h-4 w-4 rounded-full bg-green-600"></span>
          <span className="text-slate-500">Connected with {slackIntegration.config.key.team.name}</span>
        </div>
        <Button
          onClick={() => {
            refreshChannels();
            setSelectedIntegration(null);
            setOpenAddIntegrationModal(true);
          }}>
          Link channel
        </Button>
      </div>
      {!integrationArray || integrationArray.length === 0 ? (
        <div className="mt-4 w-full">
          <EmptySpaceFiller
            type="table"
            environment={environment}
            noWidgetRequired={true}
            emptyMessage="Connect your first Slack channel to get started."
          />
        </div>
      ) : (
        <div className="mt-4 flex w-full flex-col items-center justify-center">
          <div className="mt-6 w-full rounded-lg border border-slate-200">
            <div className="grid h-12 grid-cols-8 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
              <div className="col-span-2 hidden text-center sm:block">Survey</div>
              <div className="col-span-2 hidden text-center sm:block">Channel Name</div>
              <div className="col-span-2 hidden text-center sm:block">Questions</div>
              <div className="col-span-2 hidden text-center sm:block">Updated At</div>
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
                    <div className="col-span-2 text-center">{timeSince(data.createdAt.toString())}</div>
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
        Delete Integration
      </Button>

      <DeleteDialog
        open={isDeleteIntegrationModalOpen}
        setOpen={setIsDeleteIntegrationModalOpen}
        deleteWhat="Slack Connection"
        onDelete={handleDeleteIntegration}
        text="Are you sure? Your integrations will break."
        isDeleting={isDeleting}
      />
    </div>
  );
};
