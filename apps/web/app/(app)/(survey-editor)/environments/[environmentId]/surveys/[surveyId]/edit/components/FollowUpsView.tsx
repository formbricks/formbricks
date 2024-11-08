import { FollowUpItem } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/FollowUpItem";
import { FollowUpModal } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/FollowUpModal";
import { LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/components/Button";

interface FollowUpsViewProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  selectedLanguageCode: string;
  mailFrom: string;
  isSurveyFollowUpsAllowed: boolean;
}

export const FollowUpsView = ({
  localSurvey,
  setLocalSurvey,
  selectedLanguageCode,
  mailFrom,
  isSurveyFollowUpsAllowed,
}: FollowUpsViewProps) => {
  const router = useRouter();
  const [addFollowUpModalOpen, setAddFollowUpModalOpen] = useState(false);

  if (!isSurveyFollowUpsAllowed) {
    return (
      <div className="mt-12 space-y-4 p-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50">
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="mb-4 rounded-full bg-slate-100 p-3">
              <LockIcon className="h-6 w-6 text-slate-500" />
            </div>
            <p className="mb-2 text-lg font-semibold text-slate-900">Keep the Conversation Flowing</p>
            <p className="mb-2 max-w-sm text-sm text-slate-500">
              Send personalized emails when a survey is completed or when responses meet specific conditions.
              Choose whether to notify your team, yourself, or even the participant directly, keeping everyone
              in the loop on the insights that matter most.
            </p>
            <p className="mb-6 text-xs text-slate-400">Available on Startup, Scale & Enterprise plans</p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push(`/environments/${localSurvey.environmentId}/settings/billing`)}
              className="w-fit bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700">
              Upgrade to Enable Follow-ups
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
