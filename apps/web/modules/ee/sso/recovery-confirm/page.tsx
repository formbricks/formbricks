import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WEBAPP_URL } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { getSession } from "@/modules/auth/lib/session";
import { SSO_RECOVERY_COMPLETION_PATH } from "@/modules/auth/lib/verification-links";
import { resolveSsoRecoveryConfirmView } from "@/modules/ee/sso/lib/recovery-confirm";
import { SSO_RECOVERY_PROOF_COOKIE_NAME } from "@/modules/ee/sso/lib/recovery-proof";
import { Button } from "@/modules/ui/components/button";

/**
 * Asks the account holder to confirm linking an SSO provider (ENG-7395).
 *
 * The emailed recovery link used to finish the recovery by itself, so a mail scanner that followed it, or
 * a click on a mail the reader did not expect, linked someone else's identity. This page names the
 * provider and links only on an explicit submit. It runs every completion guard first, writes nothing,
 * and shows nothing to a browser the POST would refuse.
 */
export const SsoRecoveryConfirmPage = async ({
  searchParams,
}: Readonly<{ searchParams: Promise<{ state?: string | string[] }> }>) => {
  const { state } = await searchParams;

  const view = await resolveSsoRecoveryConfirmView({
    state,
    readBrowser: async () => {
      const [session, cookieStore] = await Promise.all([getSession(), cookies()]);
      return {
        recoveryProof: cookieStore.get(SSO_RECOVERY_PROOF_COOKIE_NAME)?.value,
        sessionUserId: session?.user.id,
      };
    },
  });

  if (view.kind === "refused") {
    redirect(view.redirectUrl);
  }

  const t = await getTranslate();
  const { stateId, providerName, email } = view;
  const completionUrl = new URL(SSO_RECOVERY_COMPLETION_PATH, WEBAPP_URL).toString();

  return (
    <FormWrapper>
      <h1 className="mb-4 text-center text-lg leading-7 font-semibold text-slate-900">
        {t("auth.sso_recovery_confirm.title", { provider: providerName })}
      </h1>
      <p className="mb-2 text-center text-sm text-slate-700">
        {t("auth.sso_recovery_confirm.description", { provider: providerName, email })}
      </p>
      <p className="mb-6 text-center text-sm font-medium text-slate-900">
        {t("auth.sso_recovery_confirm.warning", { provider: providerName })}
      </p>
      <form method="post" action={completionUrl} className="space-y-2">
        <input type="hidden" name="state" value={stateId} />
        <Button type="submit" name="action" value="link" className="h-11 w-full justify-center sm:h-9">
          {t("auth.sso_recovery_confirm.confirm", { provider: providerName })}
        </Button>
        {/* A POST too, not a link: cancelling spends the intent and the proof, so the emailed link can no
            longer complete anything. Leaving the page instead keeps both alive until they expire. */}
        <Button
          type="submit"
          name="action"
          value="cancel"
          variant="secondary"
          className="h-11 w-full justify-center sm:h-9">
          {t("auth.sso_recovery_confirm.cancel")}
        </Button>
      </form>
    </FormWrapper>
  );
};
