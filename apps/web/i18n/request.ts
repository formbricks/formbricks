import { getServerSession } from "next-auth";
import { getRequestConfig } from "next-intl/server";
import { authOptions } from "@formbricks/lib/authOptions";
import { getUserLanguage } from "@formbricks/lib/user/service";

export default getRequestConfig(async () => {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Session not found");
  }
  const locale = (await getUserLanguage(session.user.id)) ?? "en";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
