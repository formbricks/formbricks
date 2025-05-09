import { IntercomClientWrapper } from "@/app/intercom/IntercomClientWrapper";
import { IS_POSTHOG_CONFIGURED, POSTHOG_API_HOST, POSTHOG_API_KEY } from "@/lib/constants";
import { getUser } from "@/lib/user/service";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { ClientLogout } from "@/modules/ui/components/client-logout";
import { NoMobileOverlay } from "@/modules/ui/components/no-mobile-overlay";
import { PHProvider, PostHogPageview } from "@/modules/ui/components/post-hog-client";
import { ToasterClient } from "@/modules/ui/components/toaster-client";
import { getServerSession } from "next-auth";
import { Suspense } from "react";

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
      <Suspense>
        <PostHogPageview
          posthogEnabled={IS_POSTHOG_CONFIGURED}
          postHogApiHost={POSTHOG_API_HOST}
          postHogApiKey={POSTHOG_API_KEY}
        />
      </Suspense>
      <PHProvider posthogEnabled={IS_POSTHOG_CONFIGURED}>
        <>
          <IntercomClientWrapper user={user} />
          <ToasterClient />
          {children}
        </>
      </PHProvider>
    </>
  );
};

export default AppLayout;
