import { getServerSession } from "next-auth";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getUserLocale } from "@/lib/user/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { authOptions } from "@/modules/auth/lib/authOptions";

export const getLocale = async (): Promise<string> => {
  const session = await getServerSession(authOptions);
  let locale: string | undefined;
  if (session?.user?.id) {
    locale = await getUserLocale(session.user.id);
  } else {
    locale = await findMatchingLocale();
  }
  return locale ?? DEFAULT_LOCALE;
};
