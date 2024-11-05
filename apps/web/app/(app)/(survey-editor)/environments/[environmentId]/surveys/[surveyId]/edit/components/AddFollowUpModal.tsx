import { WorkflowIcon } from "lucide-react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Modal } from "@formbricks/ui/components/Modal";

interface AddFollowUpModalProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AddFollowUpModal = ({ localSurvey, setLocalSurvey, open, setOpen }: AddFollowUpModalProps) => {
  return (
    <Modal open={open} setOpen={setOpen} noPadding size="xl">
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <WorkflowIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">
                  Create a new follow-up for this survey
                </div>
                <div className="text-sm text-slate-500">
                  Follow-ups are used to trigger actions based on survey responses
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>rest</div>
    </Modal>
  );
};
