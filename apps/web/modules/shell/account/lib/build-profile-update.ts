import { TUserLocale, TUserPersonalInfoUpdateInput } from "@formbricks/types/user";

export interface ProfileFormValues {
  name: string;
  email: string;
  locale: TUserLocale;
}

export type ProfileDirtyFields = Partial<Record<keyof ProfileFormValues, boolean>>;

/**
 * The payload for `updateUserAction`: only the fields the person actually changed, normalised the way
 * the server compares them (trimmed name, lower-cased address).
 *
 * Sending untouched fields is not harmless: an SSO user's name is owned by the identity provider, so a
 * payload that echoes it back is one the action has to reason about. The password is attached only when
 * the address changes, because that is the one edit the server re-authenticates.
 */
export const buildProfileUpdate = ({
  values,
  dirty,
  password,
}: {
  values: ProfileFormValues;
  dirty: ProfileDirtyFields;
  password?: string;
}): TUserPersonalInfoUpdateInput => {
  const update: TUserPersonalInfoUpdateInput = {};

  if (dirty.name) {
    update.name = values.name.trim();
  }
  if (dirty.locale) {
    update.locale = values.locale;
  }
  if (dirty.email) {
    update.email = values.email.trim().toLowerCase();
    update.password = password;
  }

  return update;
};

/** Changing the address is the only profile edit that needs the current password. */
export const requiresPasswordConfirmation = (dirty: ProfileDirtyFields): boolean => Boolean(dirty.email);
