import type { TFunction } from "i18next";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { recallToHeadline } from "@/lib/utils/recall";
import type { TFollowUpEmailToUser } from "@/modules/survey/editor/types/survey-follow-up";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

/** A selectable recipient for a survey-response email (Follow-Ups + workflow send_email share this). */
export interface EmailSendToOption {
  type: "openTextElement" | "contactInfoElement" | "hiddenField" | "user" | "verifiedEmail";
  label: string;
  id: string;
}

/**
 * Builds the "who to send to" options for a survey-response email, identical to the survey
 * Follow-Ups recipient dropdown: OpenText(email) + ContactInfo(email.show) elements, hidden fields,
 * an optional verified-email entry, and the team roster (with the current user surfaced as
 * "Yourself"). Shared by `FollowUpModal` and the workflow `send_email` inspector form.
 */
export const buildEmailSendToOptions = ({
  survey,
  teamMemberDetails,
  userEmail,
  selectedLanguageCode,
  t,
}: {
  survey: TSurvey;
  teamMemberDetails: TFollowUpEmailToUser[];
  userEmail: string;
  selectedLanguageCode: string;
  t: TFunction;
}): EmailSendToOption[] => {
  const elements = getElementsFromBlocks(survey.blocks);

  const openTextAndContactElements = elements.filter((element) => {
    if (element.type === TSurveyElementTypeEnum.ContactInfo) {
      return element.email.show;
    }

    if (element.type === TSurveyElementTypeEnum.OpenText) {
      return element.inputType === "email";
    }

    return false;
  });

  const hiddenFieldIds = survey.hiddenFields.fieldIds ?? [];

  const updatedTeamMemberDetails = teamMemberDetails.map((teamMemberDetail) =>
    teamMemberDetail.email === userEmail ? { name: "Yourself", email: userEmail } : teamMemberDetail
  );

  const isUserEmailInTeamMemberDetails = updatedTeamMemberDetails.some(
    (teamMemberDetail) => teamMemberDetail.email === userEmail
  );

  const updatedTeamMembers = isUserEmailInTeamMemberDetails
    ? updatedTeamMemberDetails
    : [...updatedTeamMemberDetails, { email: userEmail, name: "Yourself" }];

  const verifiedEmailOption: EmailSendToOption[] = survey.isVerifyEmailEnabled
    ? [{ label: t("common.verified_email"), id: "verifiedEmail", type: "verifiedEmail" }]
    : [];

  return [
    ...verifiedEmailOption,
    ...openTextAndContactElements.map((element) => ({
      label: getTextContent(
        recallToHeadline(element.headline, survey, false, selectedLanguageCode)[selectedLanguageCode]
      ),
      id: element.id,
      type: (element.type === TSurveyElementTypeEnum.OpenText
        ? "openTextElement"
        : "contactInfoElement") as EmailSendToOption["type"],
    })),
    ...hiddenFieldIds.map((fieldId) => ({
      label: fieldId,
      id: fieldId,
      type: "hiddenField" as EmailSendToOption["type"],
    })),
    ...updatedTeamMembers.map((member) => ({
      label: `${member.name} (${member.email})`,
      id: member.email,
      type: "user" as EmailSendToOption["type"],
    })),
  ];
};
