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
        <Button variant="primary" size="sm" onClick={() => setAddFollowUpModalOpen(true)}>
          + New
        </Button>
      </div>

      <div>
        {!localSurvey.followUps.length && (
          <div className="text-center text-gray-500">No follow-ups added</div>
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
