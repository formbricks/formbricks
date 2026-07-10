import { TFunction } from "i18next";

// Wire contract: these string values travel from the server (via the thrown
// error's message) to the client untouched, where they are mapped to a
// localized message. Renaming a code is a breaking change — keep the constant
// and its value in sync on both ends.
export const SEGMENT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE = "segment_survey_workspace_mismatch";
export const CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE = "contact_survey_workspace_mismatch";
export const NO_CONTACTS_IN_SEGMENT_ERROR_CODE = "no_contacts_in_segment";

// Maps a personal-link error code to a localized message. Unknown values pass
// through untouched so non-coded errors (e.g. generic server errors) keep their
// original message.
export const getTranslatedPersonalLinkError = (errorCode: string, t: TFunction): string => {
  switch (errorCode) {
    case SEGMENT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE:
      return t("workspace.surveys.share.personal_links.segment_survey_workspace_mismatch");
    case CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE:
      return t("workspace.contacts.contact_survey_workspace_mismatch");
    case NO_CONTACTS_IN_SEGMENT_ERROR_CODE:
      return t("workspace.surveys.share.personal_links.no_contacts_in_segment");
    default:
      return errorCode;
  }
};
