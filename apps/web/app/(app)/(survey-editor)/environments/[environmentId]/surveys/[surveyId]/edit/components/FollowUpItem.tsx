import { deleteSurveyFollowUpAction } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import { FollowUpModal } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/FollowUpModal";
import { TrashIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TSurveyFollowUp } from "@formbricks/database/types/survey-follow-up";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Badge } from "@formbricks/ui/components/Badge";
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
  const t = useTranslations();
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
            <Badge
              size="normal"
              text={
                followUp.trigger.type === "response"
                  ? t("environments.surveys.edit.follow_ups_item_response_tag")
                  : t("environments.surveys.edit.follow_ups_item_ending_tag")
              }
              type="gray"
            />

            <Badge
              size="normal"
              text={t("environments.surveys.edit.follow_ups_item_send_email_tag")}
              type="gray"
            />
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
            <TrashIcon className="h-4 w-4 text-slate-500" />
          </Button>
        </div>
      </div>

      <FollowUpModal
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
        buttonText={t("common.delete")}
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
        text={t("environments.surveys.edit.follow_ups_delete_modal_text")}
        title={t("environments.surveys.edit.follow_ups_delete_modal_title")}
        buttonLoading={loading}
        buttonVariant="warn"
      />
    </>
  );
};
