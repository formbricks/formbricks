import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { getPostAccountDeletionRedirectUrl } from "@/modules/account/lib/post-account-deletion-redirect";
import { AccountDeletedRedirect } from "@/modules/auth/account-deleted/components/account-deleted-redirect";
import { BackToLoginButton } from "@/modules/auth/components/back-to-login-button";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";

/**
 * Where Better Auth's `GET /api/auth/delete-user/callback` sends the visitor after it consumes the
 * emailed SSO deletion link. The account — and the session — are gone by the time this renders, so it
 * must work for an anonymous visitor; the `(auth)` route group it sits in is exactly that.
 *
 * It exists so the emailed link can carry a relative `callbackURL`: the Cloud offboarding survey is
 * cross-origin on every deployment but production Cloud, and Better Auth's `originCheck` answered
 * INVALID_CALLBACK_URL for it everywhere else (ENG-3260). The survey hop happens here, in the browser.
 */
export const AccountDeletedPage = async () => {
  const t = await getTranslate();

  return (
    <FormWrapper>
      <AccountDeletedRedirect redirectUrl={getPostAccountDeletionRedirectUrl(IS_FORMBRICKS_CLOUD)} />
      <h1 className="mb-4 text-center leading-2 font-bold">{t("auth.account_deleted.heading")}</h1>
      <p className="text-center text-sm">{t("auth.account_deleted.description")}</p>
      <hr className="my-4" />
      <BackToLoginButton />
    </FormWrapper>
  );
};
