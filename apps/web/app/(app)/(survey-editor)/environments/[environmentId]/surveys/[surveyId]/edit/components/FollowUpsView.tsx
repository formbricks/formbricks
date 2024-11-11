import { getSurveyFollowUpsAction } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import { FollowUpItem } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/FollowUpItem";
import { FollowUpModal } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/FollowUpModal";
import { LockIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TSurveyFollowUp } from "@formbricks/database/types/survey-follow-up";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/components/Button";
import { LoadingSpinner } from "@formbricks/ui/components/LoadingSpinner";

interface FollowUpsViewProps {
  localSurvey: TSurvey;
  selectedLanguageCode: string;
  mailFrom: string;
  isSurveyFollowUpsAllowed: boolean;
}

export const FollowUpsView = ({
  localSurvey,
  selectedLanguageCode,
  mailFrom,
  isSurveyFollowUpsAllowed,
}: FollowUpsViewProps) => {
  const t = useTranslations();
  const router = useRouter();
  const [addFollowUpModalOpen, setAddFollowUpModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [surveyFollowUps, setSurveyFollowUps] = useState<TSurveyFollowUp[]>([]);
  const [refetch, setRefetch] = useState(false);

  useEffect(() => {
    const fetchSurveyFollowUps = async () => {
      if (!isSurveyFollowUpsAllowed) {
        return;
      }

      setLoading(true);
      try {
        const fetchedSurveyFollowUps = await getSurveyFollowUpsAction({ surveyId: localSurvey.id });
        if (fetchedSurveyFollowUps?.data) {
          setSurveyFollowUps(fetchedSurveyFollowUps.data);
        }
      } catch (error) {
        console.error(`Error fetching survey follow-ups: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSurveyFollowUps();
  }, [isSurveyFollowUpsAllowed, localSurvey.id, refetch]);

  if (!isSurveyFollowUpsAllowed) {
    return (
      <div className="mt-12 space-y-4 p-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50">
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="mb-4 rounded-full bg-slate-100 p-3">
              <LockIcon className="h-6 w-6 text-slate-500" />
            </div>
            <p className="mb-2 text-lg font-semibold text-slate-900">
              {t("environments.surveys.edit.follow_ups_empty_heading")}
            </p>
            <p className="mb-2 max-w-sm text-sm text-slate-500">
              {t("environments.surveys.edit.follow_ups_empty_description")}
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

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="mt-12 space-y-4 p-5">
      <div className="flex justify-end">
        {localSurvey.followUps.length ? (
          <Button variant="primary" size="sm" onClick={() => setAddFollowUpModalOpen(true)}>
            + {t("environments.surveys.edit.follow_ups_new")}
          </Button>
        ) : null}
      </div>

      <div>
        {!surveyFollowUps.length && (
          <div className="flex flex-col items-center space-y-2 text-center">
            <p className="text-lg font-medium text-slate-900">
              {t("environments.surveys.edit.follow_ups_empty_heading")}
            </p>
            <p className="text-sm font-medium text-slate-500">
              {t("environments.surveys.edit.follow_ups_empty_description")}
            </p>

            <Button
              className="w-fit"
              variant="primary"
              size="sm"
              onClick={() => setAddFollowUpModalOpen(true)}>
              {t("environments.surveys.edit.follow_ups_new")}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col space-y-2">
        {surveyFollowUps.map((followUp) => {
          return (
            <FollowUpItem
              key={followUp.id}
              followUp={followUp}
              localSurvey={localSurvey}
              selectedLanguageCode={selectedLanguageCode}
              mailFrom={mailFrom}
              setRefetch={setRefetch}
            />
          );
        })}
      </div>

      <FollowUpModal
        localSurvey={localSurvey}
        open={addFollowUpModalOpen}
        setOpen={setAddFollowUpModalOpen}
        selectedLanguageCode={selectedLanguageCode}
        mailFrom={mailFrom}
        setRefetch={setRefetch}
      />
    </div>
  );
};
