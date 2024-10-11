import { getServerSession } from "next-auth";
import { getRequestConfig } from "next-intl/server";
import { authOptions } from "@formbricks/lib/authOptions";
import { DEFAULT_LOCALE } from "@formbricks/lib/constants";
import { getUserLanguage } from "@formbricks/lib/user/service";

export default getRequestConfig(async () => {
  const session = await getServerSession(authOptions);

  const locale = session ? await getUserLanguage(session?.user?.id) : DEFAULT_LOCALE;

  // Lazy load the locale-specific messages
  const messages = await import(`../messages/${locale}.json`).then((module) => module.default);

  return {
    locale,
    messages,
  };
});
