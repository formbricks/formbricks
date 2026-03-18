import { getServerSession } from "next-auth";
import { ChatwootWidget } from "@/app/chatwoot/ChatwootWidget";
import { PostHogIdentify } from "@/app/posthog/PostHogIdentify";
import {
  CHATWOOT_BASE_URL,
  CHATWOOT_WEBSITE_TOKEN,
  IS_CHATWOOT_CONFIGURED,
  POSTHOG_KEY,
} from "@/lib/constants";
import { getOrganizationsByUserId } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { ClientLogout } from "@/modules/ui/components/client-logout";
import { NoMobileOverlay } from "@/modules/ui/components/no-mobile-overlay";
import { ToasterClient } from "@/modules/ui/components/toaster-client";

const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  const session = await getServerSession(authOptions);
  const user = session?.user?.id ? await getUser(session.user.id) : null;
  // If user account is deactivated, log them out instead of rendering the app
  if (user?.isActive === false || user === null) {
    return <ClientLogout />;
  }
  let isActiveCustomer = false;
  if (IS_CHATWOOT_CONFIGURED) {
    const organizations = await getOrganizationsByUserId(user.id);
    isActiveCustomer = organizations.some((organization) => {
      const stripe = organization.billing.stripe;
      const isPaidPlan = stripe?.plan === "pro" || stripe?.plan === "scale" || stripe?.plan === "custom";
      const isActiveSubscription =
        stripe?.subscriptionStatus === "active" || stripe?.subscriptionStatus === "trialing";
      return isPaidPlan && isActiveSubscription;
    });
  }

  return (
    <>
      <NoMobileOverlay />
      {POSTHOG_KEY && user && (
        <PostHogIdentify posthogKey={POSTHOG_KEY} userId={user.id} email={user.email} name={user.name} />
      )}
      {IS_CHATWOOT_CONFIGURED && (
        <ChatwootWidget
          isActiveCustomer={isActiveCustomer}
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
