import type { TUser } from "@formbricks/types/user";

/** Your own profile, as the account settings page shows it. */
export type TProfileResource = Pick<TUser, "id" | "name" | "email" | "locale">;

export const serializeProfile = ({ id, name, email, locale }: TUser): TProfileResource => ({
  id,
  name,
  email,
  locale,
});
