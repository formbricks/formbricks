import { FormbricksClient } from "@/app/(app)/components/FormbricksClient";
import { getServerSession } from "next-auth";
import { Suspense } from "react";
import { authOptions } from "@formbricks/lib/authOptions";
import { getUser } from "@formbricks/lib/user/service";
import { NoMobileOverlay } from "@formbricks/ui/components/NoMobileOverlay";
import { PHProvider, PostHogPageview } from "@formbricks/ui/components/PostHogClient";
import { ToasterClient } from "@formbricks/ui/components/ToasterClient";

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
