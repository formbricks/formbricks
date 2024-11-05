import { AddFollowUpModal } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/AddFollowUpModal";
import { useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/components/Button";

interface FollowUpsViewProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
}

export const FollowUpsView = ({ localSurvey, setLocalSurvey }: FollowUpsViewProps) => {
  const [addFollowUpModalOpen, setAddFollowUpModalOpen] = useState(false);

  return (
    <div className="mt-12 space-y-3 p-5">
      <div className="flex justify-between">
        {!localSurvey.followUps.length && (
          <div className="text-center text-gray-500">No follow-ups added</div>
        )}

        <Button variant="primary" size="sm" onClick={() => setAddFollowUpModalOpen(true)}>
          + New
        </Button>
      </div>

      <AddFollowUpModal
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        open={addFollowUpModalOpen}
        setOpen={setAddFollowUpModalOpen}
      />
    </div>
  );
};
