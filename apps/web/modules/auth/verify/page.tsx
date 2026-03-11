import { WEBAPP_URL } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { SignIn } from "@/modules/auth/verify/components/sign-in";

export const VerifyPage = async ({ searchParams }: { searchParams: Promise<{ token?: string }> }) => {
  const t = await getTranslate();
  const { token } = await searchParams;

  return token ? (
    <FormWrapper>
      <p className="text-center">{t("auth.verify.verifying")}</p>
      <SignIn token={token} webAppUrl={WEBAPP_URL} />
    </FormWrapper>
  ) : (
    <p className="text-center">{t("auth.verify.no_token_provided")}</p>
  );
};
