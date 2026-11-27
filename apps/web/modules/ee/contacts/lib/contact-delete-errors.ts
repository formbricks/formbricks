import { TFunction } from "i18next";

// Wire contract: the server sends this code as the error message and the Contacts page maps it to a
// localized message. Renaming it is a breaking change; keep both ends in sync.
export const CONTACT_IN_SHARED_DIRECTORY_ERROR_CODE = "contact_in_shared_directory";

/** A localized message for a contact delete error; any other message passes through unchanged. */
export const getTranslatedContactDeleteError = (message: string, t: TFunction): string =>
  message === CONTACT_IN_SHARED_DIRECTORY_ERROR_CODE
    ? t("workspace.contacts.delete_contact_shared_directory")
    : message;
