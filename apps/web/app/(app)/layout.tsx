import { logger } from "@formbricks/logger";
import { FormbricksProvider } from "@/app/formbricks/components/formbricks-provider";
import { PlainChat } from "@/app/plain/components/plain-chat";
import { getIsActiveCustomer } from "@/app/plain/lib/customer";
import { computePlainEmailHash } from "@/app/plain/lib/identity";
import { PostHogIdentify } from "@/app/posthog/PostHogIdentify";
import {
  FORMBRICKS_APP_URL,
  FORMBRICKS_WORKSPACE_ID,
  IS_FORMBRICKS_SURVEYS_CONFIGURED,
  IS_PLAIN_CHAT_CONFIGURED,
  PLAIN_ACTIVE_CUSTOMER_LABEL_TYPE_ID,
  PLAIN_APP_ID,
  POSTHOG_KEY,
} from "@/lib/constants";
import { getLastSurveyCreatedAtPersonProperty } from "@/lib/posthog/last-survey-created";
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

  // Resolve the paying-customer label server-side so Plain applies it to threads
  // from init time. Only queried when a label is configured to avoid extra work.
  const plainActiveCustomerLabelTypeId =
    IS_PLAIN_CHAT_CONFIGURED &&
    PLAIN_ACTIVE_CUSTOMER_LABEL_TYPE_ID &&
    user &&
    (await getIsActiveCustomer(user.id))
      ? PLAIN_ACTIVE_CUSTOMER_LABEL_TYPE_ID
      : null;

  // Most recent survey creation timestamp across every organization this person belongs to — see
  // lib/posthog/last-survey-created.ts. Recomputed on every app page load (not just at the moment a
  // survey is created) so a teammate creating a survey in a shared organization also moves this
  // forward for this person. Best-effort: read-only analytics enrichment and must never fail the app
  // shell render if the lookup errors.
  let lastSurveyCreatedAt: string | null = null;
  if (POSTHOG_KEY && user) {
    try {
      ({ last_survey_created_at: lastSurveyCreatedAt } = await getLastSurveyCreatedAtPersonProperty(user.id));
    } catch (error) {
      logger.warn({ error }, "Failed to load last survey created at for PostHog");
    }
  }

  return (
    <>
      <NoMobileOverlay />
      {POSTHOG_KEY && user && (
        <PostHogIdentify
          posthogKey={POSTHOG_KEY}
          userId={user.id}
          email={user.email}
          name={user.name}
          lastSurveyCreatedAt={lastSurveyCreatedAt}
        />
      )}
      {IS_PLAIN_CHAT_CONFIGURED && PLAIN_APP_ID && (
        <PlainChat
          appId={PLAIN_APP_ID}
          userEmail={user?.email}
          userName={user?.name}
          userId={user?.id}
          emailHash={user?.email ? computePlainEmailHash(user.email) : null}
          activeCustomerLabelTypeId={plainActiveCustomerLabelTypeId}
        />
      )}
      {IS_FORMBRICKS_SURVEYS_CONFIGURED && FORMBRICKS_WORKSPACE_ID && (
        <FormbricksProvider
          workspaceId={FORMBRICKS_WORKSPACE_ID}
          appUrl={FORMBRICKS_APP_URL}
          userId={user?.id}
          userEmail={user?.email}
          userName={user?.name}
        />
      )}
      <ToasterClient />
      {children}
    </>
  );
};

export default AppLayout;
