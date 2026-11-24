import type { TContactDirectoryMatchingKey } from "../types";

/** Longest directory name the settings UI and the internal route accept. */
export const CONTACT_DIRECTORY_NAME_MAX_LENGTH = 100;

/** Most workspaces one create or update may name; far above any organization's real count. */
export const CONTACT_DIRECTORY_WORKSPACES_MAX = 1000;

/** From this many workspaces on, a directory is shared, and the Contacts page names it. */
export const CONTACT_DIRECTORY_SHARED_MIN_WORKSPACES = 2;

type TDefaultAttributeKey = {
  key: string;
  name: string;
  description: string;
  isUnique?: boolean;
};

const BASE_DEFAULT_ATTRIBUTE_KEYS: TDefaultAttributeKey[] = [
  { key: "userId", name: "User Id", description: "The user id of a contact", isUnique: true },
  { key: "email", name: "Email", description: "The email of a contact", isUnique: true },
  { key: "firstName", name: "First Name", description: "Your contact's first name" },
  { key: "lastName", name: "Last Name", description: "Your contact's last name" },
  { key: "language", name: "Language", description: "The language preference of a contact" },
];

const EXTERNAL_ID_ATTRIBUTE_KEY: TDefaultAttributeKey = {
  key: "externalId",
  name: "External Id",
  description: "The id of a contact in your own system",
  isUnique: true,
};

/** The keys a new directory starts with (spec decision 25). */
export const getDefaultAttributeKeys = (matchingKey: TContactDirectoryMatchingKey): TDefaultAttributeKey[] =>
  matchingKey === "externalId"
    ? [...BASE_DEFAULT_ATTRIBUTE_KEYS, EXTERNAL_ID_ATTRIBUTE_KEY]
    : BASE_DEFAULT_ATTRIBUTE_KEYS;

/** Default keys every directory has, whatever its matching key. */
export const BASE_DEFAULT_ATTRIBUTE_KEY_NAMES = BASE_DEFAULT_ATTRIBUTE_KEYS.map(({ key }) => key);

export const EXTERNAL_ID_ATTRIBUTE_KEY_NAME = EXTERNAL_ID_ATTRIBUTE_KEY.key;
