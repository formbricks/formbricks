import { ChatwootWidget } from "@/app/chatwoot/components/chatwoot-widget";
import { PostHogIdentify } from "@/app/posthog/PostHogIdentify";
import {
  CHATWOOT_BASE_URL,
  CHATWOOT_WEBSITE_TOKEN,
  IS_CHATWOOT_CONFIGURED,
  POSTHOG_KEY,
} from "@/lib/constants";
import { getUser } from "@/lib/user/service";
import { getSession } from "@/modules/auth/lib/session";
import { ClientLogout } from "@/modules/ui/components/client-logout";
import { NoMobileOverlay } from "@/modules/ui/components/no-mobile-overlay";
import { ToasterClient } from "@/modules/ui/components/toaster-client";

const AppLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
  const session = await getSession();
  const user = session?.user?.id ? await getUser(session.user.id) : null;

  // If user account is deactivated, log them out instead of rendering the app
  if (user?.isActive === false) {
    return <ClientLogout />;
  }

  return (
    <>
      <NoMobileOverlay />
      {POSTHOG_KEY && user && (
        <PostHogIdentify posthogKey={POSTHOG_KEY} userId={user.id} email={user.email} name={user.name} />
      )}
      {IS_CHATWOOT_CONFIGURED && (
        <ChatwootWidget
          userEmail={user?.email}
          userName={user?.name}
          userId={user?.id}
          chatwootWebsiteToken={CHATWOOT_WEBSITE_TOKEN}
          chatwootBaseUrl={CHATWOOT_BASE_URL}
        />
      )}
      <ToasterClient />
      {children}
    </>
  );
};

export default AppLayout;
