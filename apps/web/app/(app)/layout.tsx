import { FormbricksClient } from "@/app/(app)/components/FormbricksClient";
import { IntercomClient } from "@/app/IntercomClient";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { NoMobileOverlay } from "@/modules/ui/components/no-mobile-overlay";
import { PHProvider, PostHogPageview } from "@/modules/ui/components/post-hog-client";
import { ToasterClient } from "@/modules/ui/components/toaster-client";
import { getServerSession } from "next-auth";
import React, { Suspense } from "react";
import {
  INTERCOM_APP_ID,
  INTERCOM_SECRET_KEY,
  IS_INTERCOM_CONFIGURED,
  IS_POSTHOG_CONFIGURED,
  POSTHOG_API_HOST,
  POSTHOG_API_KEY,
} from "@formbricks/lib/constants";
import { getUser } from "@formbricks/lib/user/service";

const AppLayout = async ({ children }) => {
  const session = await getServerSession(authOptions);
  const user = session?.user?.id ? await getUser(session.user.id) : null;

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
          {user ? <FormbricksClient userId={user.id} email={user.email} /> : null}
          <IntercomClient
            isIntercomConfigured={IS_INTERCOM_CONFIGURED}
            intercomSecretKey={INTERCOM_SECRET_KEY}
            user={user}
            intercomAppId={INTERCOM_APP_ID}
          />
          <ToasterClient />
          {children}
        </>
      </PHProvider>
    </>
  );
};

export default AppLayout;
