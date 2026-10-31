import "server-only";
import type { TUserLocale } from "@formbricks/types/user";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getUserLocale } from "./service";

/**
 * A user's locale read by their id, or the default one when there is no user or they have none. For
 * work done on a user's behalf outside a page request — an import, an export — so it runs the same
 * wherever it is called from.
 */
export const getUserLocaleOrDefault = async (userId: string | null): Promise<TUserLocale> =>
  (userId ? await getUserLocale(userId) : undefined) ?? DEFAULT_LOCALE;
