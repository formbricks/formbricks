import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { DEFAULT_LOCALE } from "@formbricks/lib/constants";
import { getUserLocale } from "@formbricks/lib/user/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";

export async function getLocale() {
  const session = await getServerSession(authOptions);
  let locale = session ? await getUserLocale(session.user?.id) : await findMatchingLocale();
  locale = locale ? locale : DEFAULT_LOCALE;
  return locale;
}
