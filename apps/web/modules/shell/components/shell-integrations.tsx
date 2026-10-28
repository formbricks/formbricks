import { PlainChat } from "@/app/plain/components/plain-chat";
import { getIsActiveCustomer } from "@/app/plain/lib/customer";
import { computePlainCustomerDetailsSignature } from "@/app/plain/lib/identity";
import { PostHogIdentify } from "@/app/posthog/PostHogIdentify";
import {
  IS_PLAIN_CHAT_CONFIGURED,
  IS_PRODUCTION,
  PLAIN_ACTIVE_CUSTOMER_LABEL_TYPE_ID,
  PLAIN_APP_ID,
  POSTHOG_KEY,
  SENTRY_DSN,
} from "@/lib/constants";
import { SentryUser } from "@/lib/sentry/SentryUser";
import { getUser } from "@/lib/user/service";
import { getSession } from "@/modules/auth/lib/session";

/**
 * Third-party identification and support chat for the pages that have the shell chrome. Deliberately not
 * in the `(shell)` group layout: the OAuth consent page (`/account/authorize`) lives in that group and its
 * URL carries the authorization request (`state`, `code_challenge`, `redirect_uri`, `sig`), which must
 * never reach PostHog or Plain.
 */
export const ShellIntegrations = async () => {
  const session = await getSession();
  const user = session?.user?.id ? await getUser(session.user.id) : null;

  // Resolve the paying-customer label server-side so Plain applies it to threads from init time.
  const plainActiveCustomerLabelTypeId =
    IS_PLAIN_CHAT_CONFIGURED &&
    PLAIN_ACTIVE_CUSTOMER_LABEL_TYPE_ID &&
    user &&
    (await getIsActiveCustomer(user.id))
      ? PLAIN_ACTIVE_CUSTOMER_LABEL_TYPE_ID
      : null;

  return (
    <>
      {/* Same gate as the root layout's SentryClientConfigScript: browser Sentry only runs there. */}
      {IS_PRODUCTION && SENTRY_DSN && user && <SentryUser userId={user.id} />}
      {POSTHOG_KEY && user && (
        <PostHogIdentify posthogKey={POSTHOG_KEY} userId={user.id} email={user.email} name={user.name} />
      )}
      {IS_PLAIN_CHAT_CONFIGURED && PLAIN_APP_ID && (
        <PlainChat
          appId={PLAIN_APP_ID}
          userEmail={user?.email}
          userName={user?.name}
          userId={user?.id}
          customerDetailsSignature={
            user?.email
              ? computePlainCustomerDetailsSignature({ email: user.email, externalId: user.id })
              : null
          }
          activeCustomerLabelTypeId={plainActiveCustomerLabelTypeId}
        />
      )}
    </>
  );
};
