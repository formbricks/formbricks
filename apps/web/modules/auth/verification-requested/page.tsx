import Link from "next/link";
import { logger } from "@formbricks/logger";
import { ZUserEmail } from "@formbricks/types/user";
import { IS_SMTP_CONFIGURED, WEBAPP_URL } from "@/lib/constants";
import { getEmailFromEmailToken } from "@/lib/jwt";
import { getTranslate } from "@/lingodotdev/server";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { resolveAuthCallbackUrl } from "@/modules/auth/lib/callback-url";
import { RequestVerificationEmail } from "@/modules/auth/verification-requested/components/request-verification-email";
import { VerificationMessage } from "@/modules/auth/verification-requested/components/verification-message";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";

export const VerificationRequestedPage = async ({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ token: string; callbackUrl?: string | string[] }>;
}>) => {
  const t = await getTranslate();
  const params = await searchParams;
  const { token, callbackUrl } = params;
  const resolvedCallbackUrl = resolveAuthCallbackUrl({
    searchParamCallbackUrl: callbackUrl,
    webAppUrl: WEBAPP_URL,
  });
  // No mailer configured means nothing was sent and nothing ever will be, so say so rather than
  // pointing the visitor at an inbox (ENG-2091). Derived from server config, NOT from what happened to
  // this request: a per-request outcome would only be knowable for an address we just created, which
  // would make this screen differ by whether the account already existed (ENG-2099). A transient send
  // failure on a configured mailer is logged and reported to Sentry instead, and the resend button
  // below surfaces it directly — that endpoint propagates the error rather than swallowing it.
  const sendFailed = !IS_SMTP_CONFIGURED;
  // Carry the callback (for an invite sign-up, `/invite?token=…`) into the log-in link below, so a
  // visitor who already has an account can log in and land straight back on the invite. Present for
  // every invited visitor, not just those with an account — the link must not vary with that
  // (ENG-2099), which is why it isn't conditional on anything.
  const loginHref = resolvedCallbackUrl
    ? `/auth/login?callbackUrl=${encodeURIComponent(resolvedCallbackUrl)}`
    : "/auth/login";
  try {
    const email = getEmailFromEmailToken(token);
    const parsedEmail = ZUserEmail.safeParse(email);
    if (parsedEmail.success) {
      return (
        <FormWrapper>
          <>
            <h1 className="mb-4 text-center text-lg leading-2 font-semibold text-slate-900">
              {t("auth.verification-requested.please_confirm_your_email_address")}
            </h1>
            {sendFailed ? (
              <Alert variant="warning" className="text-left" role="status">
                <AlertTitle>{t("auth.verification-requested.send_failed_title")}</AlertTitle>
                <AlertDescription>
                  <p>{t("auth.verification-requested.send_failed_description")}</p>
                </AlertDescription>
              </Alert>
            ) : (
              <VerificationMessage email={email} />
            )}
            <hr className="my-4" />
            <p className="text-center text-xs text-slate-500">
              {t("auth.verification-requested.you_didnt_receive_an_email_or_your_link_expired")}
            </p>
            <div className="mt-5">
              <RequestVerificationEmail email={email.toLowerCase()} callbackUrl={resolvedCallbackUrl} />
            </div>
            {/*
              Every visitor sees this, including one whose address already has an account — for them no
              email is coming and the resend button above no-ops, so this link is the way out. It is
              deliberately unconditional: making it depend on whether the account exists would turn this
              page into an account-existence lookup (ENG-2099). The message above is already phrased
              conditionally ("if there is an account associated with …"), so neither case is told
              anything untrue.
            */}
            <p className="mt-4 text-center text-xs text-slate-500">
              {t("auth.signup.have_an_account")}{" "}
              <Link href={loginHref} className="font-semibold text-slate-600 underline">
                {t("auth.signup.log_in")}
              </Link>
            </p>
          </>
        </FormWrapper>
      );
    } else {
      return (
        <FormWrapper>
          <p className="text-center">{t("auth.verification-requested.invalid_email_address")}</p>
        </FormWrapper>
      );
    }
  } catch (error) {
    logger.error(error, "Invalid token");
    return (
      <FormWrapper>
        <p className="text-center">{t("auth.verification-requested.invalid_token")}</p>
      </FormWrapper>
    );
  }
};
