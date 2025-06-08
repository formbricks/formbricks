import { getEmailFromEmailToken } from "@/lib/jwt";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { RequestVerificationEmail } from "@/modules/auth/verification-requested/components/request-verification-email";
import { Alert } from "@/modules/ui/components/alert";
import { T, getTranslate } from "@/tolgee/server";
import { logger } from "@formbricks/logger";
import { ZUserEmail } from "@formbricks/types/user";

export const VerificationRequestedPage = async ({ searchParams }) => {
  const t = await getTranslate();
  const { token } = await searchParams;
  try {
    const email = getEmailFromEmailToken(token);
    const parsedEmail = ZUserEmail.safeParse(email);
    if (parsedEmail.success) {
      return (
        <FormWrapper>
          <>
            <h1 className="leading-2 mb-4 text-center text-lg font-semibold text-slate-900">
              {t("auth.verification-requested.please_confirm_your_email_address")}
            </h1>
            <p className="text-center text-sm text-slate-700">
              <T
                keyName="auth.verification-requested.we_sent_an_email_to"
                params={{ email, span: <span /> }}
              />
              {t("auth.verification-requested.please_click_the_link_in_the_email_to_activate_your_account")}
            </p>
            <Alert variant="info" className="mt-4 text-center">
              <p>{t("auth.verification-requested.verification_email_successfully_sent_info")}</p>
            </Alert>
            <hr className="my-4" />
            <p className="text-center text-xs text-slate-500">
              {t("auth.verification-requested.you_didnt_receive_an_email_or_your_link_expired")}
            </p>
            <div className="mt-5">
              <RequestVerificationEmail email={email.toLowerCase()} />
            </div>
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
