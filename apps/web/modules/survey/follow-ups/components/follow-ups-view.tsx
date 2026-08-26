"use client";

import { MailIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyFollowUp } from "@formbricks/types/surveys/follow-up";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { TFollowUpEmailToUser } from "@/modules/survey/editor/types/survey-follow-up";
import { FollowUpItem } from "@/modules/survey/follow-ups/components/follow-up-item";
import { FollowUpModal } from "@/modules/survey/follow-ups/components/follow-up-modal";
import {
  WORKFLOWS_DOCS_URL,
  formatSurveyFollowUpsSunsetDate,
} from "@/modules/survey/follow-ups/lib/deprecation";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";

interface FollowUpsViewProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  selectedLanguageCode: string;
  mailFrom: string;
  isSurveyFollowUpsAllowed: boolean;
  isWorkflowsAllowed: boolean;
  userEmail: string;
  teamMemberDetails: TFollowUpEmailToUser[];
  locale: TUserLocale;
}

export const FollowUpsView = ({
  localSurvey,
  setLocalSurvey,
  selectedLanguageCode,
  mailFrom,
  isSurveyFollowUpsAllowed,
  isWorkflowsAllowed,
  userEmail,
  teamMemberDetails,
  locale,
}: Readonly<FollowUpsViewProps>) => {
  const { workspace } = useWorkspace();
  const { t } = useTranslation();
  const [addFollowUpModalOpen, setAddFollowUpModalOpen] = useState(false);

  const surveyFollowUps: TSurveyFollowUp[] = localSurvey.followUps.filter((f) => !f.deleted);

  // Follow-ups are deprecated, so the only place a new one can still be started is a deployment
  // Workflows cannot reach yet. Everywhere else the entry point is a Workflow — that is what stops
  // the migration debt growing while nothing is removed.
  const canCreateFollowUps = isSurveyFollowUpsAllowed && !isWorkflowsAllowed;
  const sunsetDate = formatSurveyFollowUpsSunsetDate(locale);

  return (
    <div className="mt-12 space-y-4 p-5">
      <Alert variant="warning" role="status">
        <AlertTitle>{t("workspace.surveys.edit.follow_ups_deprecation_title")}</AlertTitle>
        <AlertDescription>
          {t("workspace.surveys.edit.follow_ups_deprecation_description", { date: sunsetDate })}
        </AlertDescription>
        <AlertButton asChild>
          <Link href={WORKFLOWS_DOCS_URL} target="_blank" rel="noopener noreferrer">
            {t("common.learn_more")}
          </Link>
        </AlertButton>
      </Alert>

      {/* An entitlement can lapse (a Cloud trial, or a downgrade) while the survey keeps carrying
          its follow-ups. The runtime already refuses to send them, so say so rather than leaving
          the list looking live. */}
      {!isSurveyFollowUpsAllowed && surveyFollowUps.length > 0 && (
        <Alert variant="error" role="status">
          <AlertTitle>{t("workspace.surveys.edit.follow_ups_inactive_title")}</AlertTitle>
          <AlertDescription>{t("workspace.surveys.edit.follow_ups_inactive_description")}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        {isWorkflowsAllowed && workspace ? (
          <Button size="sm" asChild>
            {/* New tab on purpose: the survey editor has no autosave, so navigating away here
                would drop whatever the author has not saved yet. */}
            <Link href={`/workspaces/${workspace.id}/workflows`} target="_blank" rel="noopener noreferrer">
              {t("common.new_workflow")}
            </Link>
          </Button>
        ) : null}
        {canCreateFollowUps && surveyFollowUps.length > 0 ? (
          <Button size="sm" onClick={() => setAddFollowUpModalOpen(true)}>
            + {t("workspace.surveys.edit.follow_ups_new")}
          </Button>
        ) : null}
      </div>

      {/* Only offered where a new follow-up can still be started. Reachable with Workflows
          available too — delete the last follow-up in-session — and there the promo card would be a
          dead end advertising the very thing this deprecation is trying to stop. */}
      {!surveyFollowUps.length && canCreateFollowUps && (
        <div className="flex flex-col items-center gap-y-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <div className="flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 p-2">
            <MailIcon className="size-6 text-slate-500" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-800">
              {t("workspace.surveys.edit.follow_ups_empty_heading")}
            </p>
            <p className="text-sm text-slate-500">
              {t("workspace.surveys.edit.follow_ups_empty_description")}
            </p>
          </div>

          <Button className="w-fit" size="sm" onClick={() => setAddFollowUpModalOpen(true)}>
            {t("workspace.surveys.edit.follow_ups_new")}
          </Button>
        </div>
      )}

      {surveyFollowUps.length > 0 && (
        <div className="flex flex-col gap-y-2">
          {surveyFollowUps.map((followUp) => {
            return (
              <FollowUpItem
                key={followUp.id}
                followUp={followUp}
                localSurvey={localSurvey}
                setLocalSurvey={setLocalSurvey}
                selectedLanguageCode={selectedLanguageCode}
                mailFrom={mailFrom}
                userEmail={userEmail}
                teamMemberDetails={teamMemberDetails}
                locale={locale}
                canDuplicate={canCreateFollowUps}
              />
            );
          })}
        </div>
      )}

      <FollowUpModal
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        open={addFollowUpModalOpen}
        setOpen={setAddFollowUpModalOpen}
        selectedLanguageCode={selectedLanguageCode}
        mailFrom={mailFrom}
        userEmail={userEmail}
        teamMemberDetails={teamMemberDetails}
        locale={locale}
      />
    </div>
  );
};
