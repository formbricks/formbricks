import { getServerSession } from "next-auth";
import { TUserLocale } from "@formbricks/types/user";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getUserLocale } from "@/lib/user/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { authOptions } from "@/modules/auth/lib/authOptions";

export const getLocale = async (): Promise<TUserLocale> => {
  const session = await getServerSession(authOptions);
  let locale: TUserLocale | undefined;
  if (session?.user?.id) {
    locale = await getUserLocale(session.user.id);
  } else {
    locale = await findMatchingLocale();
  }
  return locale ?? DEFAULT_LOCALE;
};
