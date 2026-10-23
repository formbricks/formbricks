import type { TFunction } from "../types/translations";

/**
 * The retention notice's opening line, for what the email actually lists: a person told only about
 * responses must not read that their surveys are being archived, and the other way round. Each key is
 * spelled out in a `t()` call, so the translation scan finds it.
 */
export const getRetentionNoticeIntro = (
  t: TFunction,
  {
    organizationName,
    hasResponseDeletions,
    hasArchivedSurveys,
  }: Readonly<{ organizationName: string; hasResponseDeletions: boolean; hasArchivedSurveys: boolean }>
): string => {
  if (hasResponseDeletions && !hasArchivedSurveys) {
    return t("emails.retention_notice_email_text_responses", { organizationName });
  }
  if (hasArchivedSurveys && !hasResponseDeletions) {
    return t("emails.retention_notice_email_text_surveys", { organizationName });
  }
  return t("emails.retention_notice_email_text", { organizationName });
};
