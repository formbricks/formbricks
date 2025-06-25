import { DEFAULT_LOCALE } from "@/lib/constants";
import { getUserLocale } from "@/lib/user/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";

export async function getLocale() {
  const session = await getServerSession(authOptions);
  let locale = session ? await getUserLocale(session.user?.id) : await findMatchingLocale();
  locale = locale ? locale : DEFAULT_LOCALE;
  return locale;
}
