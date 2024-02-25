"use client";

import { useState } from "react";
import toast from "react-hot-toast";

import { timeSince } from "@formbricks/lib/time";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationSlack, TIntegrationSlackConfig } from "@formbricks/types/integration/slack";
import { Button } from "@formbricks/ui/Button";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import EmptySpaceFiller from "@formbricks/ui/EmptySpaceFiller";

import { deleteIntegrationAction } from "../actions";

interface HomeProps {
  environment: TEnvironment;
  slackIntegration: TIntegrationSlack;
  setOpenAddIntegrationModal: (v: boolean) => void;
  setIsConnected: (v: boolean) => void;
  setSelectedIntegration: (v: (TIntegrationSlackConfig & { index: number }) | null) => void;
  refreshSheet: () => void;
}

export default function Home({
  environment,
  slackIntegration,
  setOpenAddIntegrationModal,
  setIsConnected,
  setSelectedIntegration,
  refreshSheet,
}: HomeProps) {
  const [isDeleteIntegrationModalOpen, setIsDeleteIntegrationModalOpen] = useState(false);
  const integrationArray = slackIntegration
    ? slackIntegration.config.data
      ? slackIntegration.config.data
      : []
    : [];
  const [isDeleting, setisDeleting] = useState(false);

  const handleDeleteIntegration = async () => {
    try {
      setisDeleting(true);
      await deleteIntegrationAction(slackIntegration.id);
      setIsConnected(false);
      toast.success("Integration removed successfully");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setisDeleting(false);
      setIsDeleteIntegrationModalOpen(false);
    }
  };

  // TODO
  const editIntegration = (index: number) => {
    setSelectedIntegration({
      ...slackIntegration.config.data[index],
      index: index,
    });
    setOpenAddIntegrationModal(true);
  };

  return (
    <div className="mt-6 flex w-full flex-col items-center justify-center p-6">
      <div className="flex w-full justify-end">
        <div className="mr-6 flex items-center">
          <span className="mr-4 h-4 w-4 rounded-full bg-green-600"></span>
          <span
            className="cursor-pointer text-slate-500"
            onClick={() => {
              setIsDeleteIntegrationModalOpen(true);
            }}>
            Connected with {slackIntegration.config.user.name}
          </span>
        </div>
        <Button
          variant="darkCTA"
          onClick={() => {
            refreshSheet();
            setSelectedIntegration(null);
            setOpenAddIntegrationModal(true);
          }}>
          Map new Channel
        </Button>
      </div>
      {!integrationArray || integrationArray.length === 0 ? (
        <div className="mt-4 w-full">
          <EmptySpaceFiller
            type="table"
            environment={environment}
            noWidgetRequired={true}
            emptyMessage="Your Slack channel mappings will appear here as soon as you add them. ⏲️"
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
                    className="m-2 grid h-16  grid-cols-8 content-center rounded-lg hover:bg-slate-100"
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
}
