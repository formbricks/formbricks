"use client";

import { TFollowUpEmailToUser } from "@/modules/survey/editor/types/survey-follow-up";
import { FollowUpModal } from "@/modules/survey/follow-ups/components/follow-up-modal";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { createId } from "@paralleldrive/cuid2";
import { useTranslate } from "@tolgee/react";
import { CopyPlusIcon, TrashIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { TSurveyFollowUp } from "@formbricks/database/types/survey-follow-up";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface FollowUpItemProps {
  followUp: TSurveyFollowUp;
  localSurvey: TSurvey;
  selectedLanguageCode: string;
  mailFrom: string;
  userEmail: string;
  teamMemberDetails: TFollowUpEmailToUser[];
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  locale: TUserLocale;
}

export const FollowUpItem = ({
  followUp,
  localSurvey,
  mailFrom,
  selectedLanguageCode,
  userEmail,
  teamMemberDetails,
  setLocalSurvey,
  locale,
}: FollowUpItemProps) => {
  const { t } = useTranslate();
  const [editFollowUpModalOpen, setEditFollowUpModalOpen] = useState(false);
  const [deleteFollowUpModalOpen, setDeleteFollowUpModalOpen] = useState(false);

  const isEmailToInvalid = useMemo(() => {
    const { to } = followUp.action.properties;

    if (!to) return true;

    const matchedQuestion = localSurvey.questions.find((question) => question.id === to);
    const matchedHiddenField = (localSurvey.hiddenFields?.fieldIds ?? []).find((fieldId) => fieldId === to);

    const updatedTeamMemberDetails = teamMemberDetails.map((teamMemberDetail) => {
      if (teamMemberDetail.email === userEmail) {
        return { name: "Yourself", email: userEmail };
      }

      return teamMemberDetail;
    });

    const isUserEmailInTeamMemberDetails = updatedTeamMemberDetails.some(
      (teamMemberDetail) => teamMemberDetail.email === userEmail
    );

    const updatedTeamMembers = isUserEmailInTeamMemberDetails
      ? updatedTeamMemberDetails
      : [...updatedTeamMemberDetails, { email: userEmail, name: "Yourself" }];

    const matchedEmail = updatedTeamMembers.find((detail) => detail.email === to);

    if (!matchedQuestion && !matchedHiddenField && !matchedEmail) return true;

    if (matchedQuestion) {
      if (
        ![TSurveyQuestionTypeEnum.OpenText, TSurveyQuestionTypeEnum.ContactInfo].includes(
          matchedQuestion.type
        )
      ) {
        return true;
      }

      if (
        matchedQuestion.type === TSurveyQuestionTypeEnum.OpenText &&
        matchedQuestion.inputType !== "email"
      ) {
        return true;
      }
    }

    return false;
  }, [
    followUp.action.properties,
    localSurvey.hiddenFields?.fieldIds,
    localSurvey.questions,
    teamMemberDetails,
    userEmail,
  ]);

  const isEndingInvalid = useMemo(() => {
    return followUp.trigger.type === "endings" && !followUp.trigger.properties?.endingIds?.length;
  }, [followUp.trigger.properties?.endingIds?.length, followUp.trigger.type]);

  const duplicateFollowUp = useCallback(() => {
    const newFollowUp = {
      ...followUp,
      id: createId(),
      name: `${followUp.name} (copy)`,
    };

    setLocalSurvey((prev) => ({
      ...prev,
      followUps: [...prev.followUps, newFollowUp],
    }));
  }, [followUp, setLocalSurvey]);

  return (
    <>
      <div className="relative cursor-pointer rounded-lg border border-slate-300 bg-white p-4 hover:bg-slate-50">
        <button
          className="flex w-full flex-col items-start space-y-2"
          onClick={() => {
            setEditFollowUpModalOpen(true);
          }}>
          <h3 className="text-slate-900">{followUp.name}</h3>
          <div className="flex space-x-2">
            <Badge
              size="normal"
              type="gray"
              text={
                followUp.trigger.type === "response"
                  ? t("environments.surveys.edit.follow_ups_item_response_tag")
                  : t("environments.surveys.edit.follow_ups_item_ending_tag")
              }
            />

            <Badge
              size="normal"
              type="gray"
              text={t("environments.surveys.edit.follow_ups_item_send_email_tag")}
            />

            {isEmailToInvalid || isEndingInvalid ? (
              <Badge
                size="normal"
                type="warning"
                text={t("environments.surveys.edit.follow_ups_item_issue_detected_tag")}
              />
            ) : null}
          </div>
        </button>

        <div className="absolute right-4 top-4 flex items-center">
          <TooltipRenderer tooltipContent={t("common.delete")}>
            <Button
              variant="ghost"
              size="icon"
              onClick={async (e) => {
                e.stopPropagation();
                setDeleteFollowUpModalOpen(true);
              }}
              aria-label={t("common.delete")}>
              <TrashIcon className="h-4 w-4 text-slate-500" />
            </Button>
          </TooltipRenderer>

          <TooltipRenderer tooltipContent={t("common.duplicate")}>
            <Button
              variant="ghost"
              size="icon"
              onClick={async (e) => {
                e.stopPropagation();
                duplicateFollowUp();
              }}
              aria-label={t("common.duplicate")}>
              <CopyPlusIcon className="h-4 w-4 text-slate-500" />
            </Button>
          </TooltipRenderer>
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
          followUpName: followUp.name,
          triggerType: followUp.trigger.type,
          endingIds: followUp.trigger.type === "endings" ? followUp.trigger.properties?.endingIds : null,
          subject: followUp.action.properties.subject,
          body: followUp.action.properties.body,
          emailTo: followUp.action.properties.to,
          replyTo: followUp.action.properties.replyTo,
          attachResponseData: followUp.action.properties.attachResponseData,
        }}
        mode="edit"
        teamMemberDetails={teamMemberDetails}
        userEmail={userEmail}
        locale={locale}
      />

      <ConfirmationModal
        open={deleteFollowUpModalOpen}
        setOpen={setDeleteFollowUpModalOpen}
        buttonText={t("common.delete")}
        onConfirm={async () => {
          setLocalSurvey((prev) => {
            return {
              ...prev,
              followUps: prev.followUps.map((f) => {
                if (f.id === followUp.id) {
                  return {
                    ...f,
                    deleted: true,
                  };
                }

                return f;
              }),
            };
          });
        }}
        text={t("environments.surveys.edit.follow_ups_delete_modal_text")}
        title={t("environments.surveys.edit.follow_ups_delete_modal_title")}
        buttonVariant="destructive"
      />
    </>
  );
};
