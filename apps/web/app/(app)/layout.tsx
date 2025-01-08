import { FormbricksClient } from "@/app/(app)/components/FormbricksClient";
import { IntercomClient } from "@/app/IntercomClient";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { NoMobileOverlay } from "@/modules/ui/components/no-mobile-overlay";
import { PHProvider, PostHogPageview } from "@/modules/ui/components/post-hog-client";
import { ToasterClient } from "@/modules/ui/components/toaster-client";
import { getServerSession } from "next-auth";
import { Suspense } from "react";
import { INTERCOM_SECRET_KEY, IS_INTERCOM_CONFIGURED } from "@formbricks/lib/constants";
import { getUser } from "@formbricks/lib/user/service";

const AppLayout = async ({ children }) => {
  const session = await getServerSession(authOptions);
  const user = session?.user?.id ? await getUser(session.user.id) : null;

  return (
    <>
      <NoMobileOverlay />
      <Suspense>
        <PostHogPageview />
      </Suspense>
      <PHProvider>
        <>
          {user ? <FormbricksClient userId={user.id} email={user.email} /> : null}
          <IntercomClient
            isIntercomConfigured={IS_INTERCOM_CONFIGURED}
            intercomSecretKey={INTERCOM_SECRET_KEY}
            user={user}
          />
          <ToasterClient />
          {children}
        </>
      </PHProvider>
    </>
  );
};

export default AppLayout;
