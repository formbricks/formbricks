import { FormbricksClient } from "@/app/(app)/components/FormbricksClient";
import { IntercomClientWrapper } from "@/app/intercom/IntercomClientWrapper";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { PHProvider, PostHogPageview } from "@/modules/ui/components/post-hog-client";
import { ToasterClient } from "@/modules/ui/components/toaster-client";
import { getServerSession } from "next-auth";
import { Suspense } from "react";
import { IS_POSTHOG_CONFIGURED, POSTHOG_API_HOST, POSTHOG_API_KEY } from "@formbricks/lib/constants";
import { getUser } from "@formbricks/lib/user/service";
import { AlchemyWalletProvider } from "@formbricks/web3";

const AppLayout = async ({ children }) => {
  const apiKey = process.env.ALCHEMY_API_KEY || "";
  const session = await getServerSession(authOptions);
  const user = session?.user?.id ? await getUser(session.user.id) : null;

  return (
    <>
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
          <IntercomClientWrapper user={user} />
          <ToasterClient />
          <AlchemyWalletProvider apiKey={apiKey}>{children}</AlchemyWalletProvider>
        </>
      </PHProvider>
    </>
  );
};

export default AppLayout;
