import { TUserLocale } from "@formbricks/types/user";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getUserLocale } from "@/lib/user/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getSession } from "@/modules/auth/lib/session";

export const getLocale = async (): Promise<TUserLocale> => {
  const session = await getSession();
  let locale: TUserLocale | undefined;
  if (session?.user?.id) {
    locale = await getUserLocale(session.user.id);
  } else {
    locale = await findMatchingLocale();
  }
  return locale ?? DEFAULT_LOCALE;
};
