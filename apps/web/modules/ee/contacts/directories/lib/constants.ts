/** Longest directory name the settings UI and the internal route accept. */
export const CONTACT_DIRECTORY_NAME_MAX_LENGTH = 100;

/** Most workspaces one create or update may name; far above any organization's real count. */
export const CONTACT_DIRECTORY_WORKSPACES_MAX = 1000;

/** Most targeted surveys the Manage dialog's confirm step lists per workspace; it counts the rest. */
export const CONTACT_DIRECTORY_TARGETED_SURVEYS_LIMIT = 100;

/** From this many workspaces on, a directory is shared, and the Contacts page names it. */
export const CONTACT_DIRECTORY_SHARED_MIN_WORKSPACES = 2;

type TDefaultAttributeKey = {
  key: string;
  name: string;
  description: string;
  isUnique?: boolean;
};

const DEFAULT_ATTRIBUTE_KEYS: TDefaultAttributeKey[] = [
  { key: "userId", name: "User Id", description: "The user id of a contact", isUnique: true },
  { key: "email", name: "Email", description: "The email of a contact", isUnique: true },
  { key: "firstName", name: "First Name", description: "Your contact's first name" },
  { key: "lastName", name: "Last Name", description: "Your contact's last name" },
  { key: "language", name: "Language", description: "The language preference of a contact" },
];

/** The keys a new directory starts with: the same five whatever its matching key. */
export const getDefaultAttributeKeys = (): TDefaultAttributeKey[] =>
  DEFAULT_ATTRIBUTE_KEYS.map((key) => ({ ...key }));
