import { FormbricksClient } from "@/app/(app)/components/FormbricksClient";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { NoMobileOverlay } from "@/modules/ui/components/no-mobile-overlay";
import { PHProvider, PostHogPageview } from "@/modules/ui/components/post-hog-client";
import { ToasterClient } from "@/modules/ui/components/toaster-client";
import { getServerSession } from "next-auth";
import { Suspense } from "react";
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
          {session && user ? <FormbricksClient session={session} userEmail={user.email} /> : null}
          <ToasterClient />
          {children}
        </>
      </PHProvider>
    </>
  );
};

export default AppLayout;
