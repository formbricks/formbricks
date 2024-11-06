import { deleteSurveyFollowUpAction } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import { AddFollowUpModal } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/AddFollowUpModal";
import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TSurveyFollowUp } from "@formbricks/database/types/survey-follow-up";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/components/Button";
import { ConfirmationModal } from "@formbricks/ui/components/ConfirmationModal";

interface FollowUpItemProps {
  followUp: TSurveyFollowUp;
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  selectedLanguageCode: string;
  mailFrom: string;
}

export const FollowUpItem = ({
  followUp,
  localSurvey,
  mailFrom,
  selectedLanguageCode,
  setLocalSurvey,
}: FollowUpItemProps) => {
  const [editFollowUpModalOpen, setEditFollowUpModalOpen] = useState(false);
  const [deleteFollowUpModalOpen, setDeleteFollowUpModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  return (
    <>
      <div className="relative cursor-pointer rounded-md border border-slate-300 p-4 hover:bg-slate-100">
        <div
          className="flex flex-col space-y-2"
          onClick={() => {
            setEditFollowUpModalOpen(true);
          }}>
          <h3 className="text-slate-900">{followUp.name}</h3>
          <div className="flex space-x-2">
            <div className="w-fit rounded-md border border-slate-300 bg-slate-300 px-2 py-1">
              <span className="text-sm text-slate-900">
                {followUp.trigger.type === "response" ? "Any response" : "Ending(s)"}
              </span>
            </div>

            <div className="w-fit rounded-md border border-slate-300 bg-slate-300 px-2 py-1">
              <span className="text-sm text-slate-900">Send Email</span>
            </div>
          </div>
        </div>

        <div className="absolute right-4 top-4">
          <Button
            variant="minimal"
            size="sm"
            onClick={async (e) => {
              e.stopPropagation();

              setDeleteFollowUpModalOpen(true);
            }}>
            <TrashIcon className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>

      <AddFollowUpModal
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        open={editFollowUpModalOpen}
        setOpen={setEditFollowUpModalOpen}
        mailFrom={mailFrom}
        selectedLanguageCode={selectedLanguageCode}
        defaultValues={{
          surveyFollowUpId: followUp.id,
          name: followUp.name,
          triggerType: followUp.trigger.type,
          endingIds: followUp.trigger.type === "endings" ? followUp.trigger.properties?.endingIds : null,
          subject: followUp.action.properties.subject,
          body: followUp.action.properties.body,
          emailTo: followUp.action.properties.to,
          replyTo: followUp.action.properties.replyTo,
        }}
        mode="edit"
      />

      <ConfirmationModal
        open={deleteFollowUpModalOpen}
        setOpen={setDeleteFollowUpModalOpen}
        buttonText="Delete"
        onConfirm={async () => {
          setLoading(true);
          await deleteSurveyFollowUpAction({
            surveyId: localSurvey.id,
            surveyFollowUpId: followUp.id,
          });

          setTimeout(() => {
            router.refresh();
          }, 100);

          setLoading(false);
          setDeleteFollowUpModalOpen(false);
        }}
        text="Are you sure you want to delete this follow-up?"
        title="Delete Follow-Up"
        buttonLoading={loading}
        buttonVariant="warn"
      />
    </>
  );
};
