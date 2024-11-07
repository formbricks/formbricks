import { FollowUpItem } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/FollowUpItem";
import { FollowUpModal } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/FollowUpModal";
import { useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/components/Button";

interface FollowUpsViewProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  selectedLanguageCode: string;
  mailFrom: string;
}

export const FollowUpsView = ({
  localSurvey,
  setLocalSurvey,
  selectedLanguageCode,
  mailFrom,
}: FollowUpsViewProps) => {
  const [addFollowUpModalOpen, setAddFollowUpModalOpen] = useState(false);

  return (
    <div className="mt-12 space-y-4 p-5">
      <div className="flex justify-end">
        {localSurvey.followUps.length ? (
          <Button variant="primary" size="sm" onClick={() => setAddFollowUpModalOpen(true)}>
            + New
          </Button>
        ) : null}
      </div>

      <div>
        {!localSurvey.followUps.length && (
          <div className="flex flex-col items-center space-y-2 text-center">
            <p className="text-lg font-medium text-slate-900">Keep the Conversation Flowing</p>
            <p className="text-sm font-medium text-slate-500">
              Send personalized emails when a survey is completed or when responses meet specific conditions.
              Choose whether to notify your team, yourself, or even the participant directly, keeping everyone
              in the loop on the insights that matter most.
            </p>

            <Button
              className="w-fit"
              variant="primary"
              size="sm"
              onClick={() => setAddFollowUpModalOpen(true)}>
              + New Follow-up
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col space-y-2">
        {localSurvey.followUps.map((followUp) => {
          return (
            <FollowUpItem
              key={followUp.id}
              followUp={followUp}
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
              selectedLanguageCode={selectedLanguageCode}
              mailFrom={mailFrom}
            />
          );
        })}
      </div>

      <FollowUpModal
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        open={addFollowUpModalOpen}
        setOpen={setAddFollowUpModalOpen}
        selectedLanguageCode={selectedLanguageCode}
        mailFrom={mailFrom}
      />
    </div>
  );
};
