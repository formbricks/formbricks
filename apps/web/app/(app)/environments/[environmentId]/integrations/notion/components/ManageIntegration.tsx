import { deleteIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import { Trash2Icon } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { timeSince } from "@formbricks/lib/time";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationNotion, TIntegrationNotionConfigData } from "@formbricks/types/integration/notion";
import { Button } from "@formbricks/ui/components/Button";
import { DeleteDialog } from "@formbricks/ui/components/DeleteDialog";
import { EmptySpaceFiller } from "@formbricks/ui/components/EmptySpaceFiller";

interface ManageIntegrationProps {
  environment: TEnvironment;
  notionIntegration: TIntegrationNotion;
  setOpenAddIntegrationModal: React.Dispatch<React.SetStateAction<boolean>>;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedIntegration: React.Dispatch<
    React.SetStateAction<(TIntegrationNotionConfigData & { index: number }) | null>
  >;
}

export const ManageIntegration = ({
  environment,
  notionIntegration,
  setOpenAddIntegrationModal,
  setIsConnected,
  setSelectedIntegration,
}: ManageIntegrationProps) => {
  const [isDeleteIntegrationModalOpen, setIsDeleteIntegrationModalOpen] = useState(false);
  const [isDeleting, setisDeleting] = useState(false);
  const integrationArray = notionIntegration
    ? notionIntegration.config.data
      ? notionIntegration.config.data
      : []
    : [];

  const handleDeleteIntegration = async () => {
    try {
      setisDeleting(true);
      await deleteIntegrationAction({ integrationId: notionIntegration.id });
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
    setSelectedIntegration({ ...notionIntegration.config.data[index], index });
    setOpenAddIntegrationModal(true);
  };

  return (
    <div className="mt-6 flex w-full flex-col items-center justify-center p-6">
      <div className="flex w-full justify-end">
        <div className="mr-6 flex items-center">
          <span className="mr-4 h-4 w-4 rounded-full bg-green-600"></span>
          <span className="text-slate-500">
            Connected with {notionIntegration.config.key.workspace_name} workspace
          </span>
        </div>
        <Button
          onClick={() => {
            setSelectedIntegration(null);
            setOpenAddIntegrationModal(true);
          }}>
          Link new database
        </Button>
      </div>
      {!integrationArray || integrationArray.length === 0 ? (
        <div className="mt-4 w-full">
          <EmptySpaceFiller
            type="table"
            environment={environment}
            noWidgetRequired={true}
            emptyMessage="Your Notion integrations will appear here as soon as you add them. ⏲️"
          />
        </div>
      ) : (
        <div className="mt-4 flex w-full flex-col items-center justify-center">
          <div className="mt-6 w-full rounded-lg border border-slate-200">
            <div className="grid h-12 grid-cols-6 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
              <div className="col-span-2 hidden text-center sm:block">Survey</div>
              <div className="col-span-2 hidden text-center sm:block">Database Name</div>
              <div className="col-span-2 hidden text-center sm:block">Updated At</div>
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
        deleteWhat="Notion Connection"
        onDelete={handleDeleteIntegration}
        text="Are you sure? Your integrations will break."
        isDeleting={isDeleting}
      />
    </div>
  );
};
