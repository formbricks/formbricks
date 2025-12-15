import { getServerSession } from "next-auth";
import { ChatwootWidget } from "@/app/chatwoot/ChatwootWidget";
import { CHATWOOT_BASE_URL, CHATWOOT_WEBSITE_TOKEN, IS_CHATWOOT_CONFIGURED } from "@/lib/constants";
import { getUser } from "@/lib/user/service";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { ClientLogout } from "@/modules/ui/components/client-logout";
import { NoMobileOverlay } from "@/modules/ui/components/no-mobile-overlay";
import { ToasterClient } from "@/modules/ui/components/toaster-client";

const AppLayout = async ({ children }) => {
  const session = await getServerSession(authOptions);
  const user = session?.user?.id ? await getUser(session.user.id) : null;

  // If user account is deactivated, log them out instead of rendering the app
  if (user?.isActive === false) {
    return <ClientLogout />;
  }

  return (
    <>
      <NoMobileOverlay />
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
