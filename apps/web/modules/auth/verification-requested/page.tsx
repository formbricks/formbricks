import Link from "next/link";
import { logger } from "@formbricks/logger";
import { ZUserEmail } from "@formbricks/types/user";
import { WEBAPP_URL } from "@/lib/constants";
import { getEmailFromEmailToken } from "@/lib/jwt";
import { getTranslate } from "@/lingodotdev/server";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { resolveAuthCallbackUrl } from "@/modules/auth/lib/callback-url";
import { RequestVerificationEmail } from "@/modules/auth/verification-requested/components/request-verification-email";
import { VerificationMessage } from "@/modules/auth/verification-requested/components/verification-message";

export const VerificationRequestedPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ token: string; callbackUrl?: string | string[] }>;
}) => {
  const t = await getTranslate();
  const params = await searchParams;
  const { token, callbackUrl } = params;
  const resolvedCallbackUrl = resolveAuthCallbackUrl({
    searchParamCallbackUrl: callbackUrl,
    webAppUrl: WEBAPP_URL,
  });
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
            <VerificationMessage email={email} />
            <hr className="my-4" />
            <p className="text-center text-xs text-slate-500">
              {t("auth.verification-requested.you_didnt_receive_an_email_or_your_link_expired")}
            </p>
            <div className="mt-5">
              <RequestVerificationEmail email={email.toLowerCase()} callbackUrl={resolvedCallbackUrl} />
            </div>
            {/*
              A sign-up with an address that already has an account lands here too — the response is
              deliberately identical for existing and new addresses so it can't be used to enumerate
              accounts. For that visitor there is no email coming and the resend button above no-ops
              (it returns early for an already-verified address), so this generic line is their way
              out. It reveals nothing: every visitor to this page sees it. (ENG-2091)
            */}
            <p className="mt-4 text-center text-xs text-slate-500">
              {t("auth.verification-requested.already_have_an_account")}{" "}
              <Link href="/auth/login" className="font-semibold text-slate-600 underline">
                {t("auth.verification-requested.log_in")}
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
