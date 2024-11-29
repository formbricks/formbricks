import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE } from "@formbricks/lib/constants";
import { getUserLocale } from "@formbricks/lib/user/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";

export default getRequestConfig(async () => {
  const session = await getServerSession(authOptions);
  const locale = session ? await getUserLocale(session.user?.id) : await findMatchingLocale();
  // Lazy load the locale-specific messages
  const messages = await import(`@formbricks/lib/messages/${locale ?? DEFAULT_LOCALE}.json`).then(
    (module) => module.default
  );

  return {
    locale,
    messages,
  };
});
