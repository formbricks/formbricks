import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { SignIn } from "@/modules/auth/verify/components/sign-in";
import { getTranslate } from "@/tolgee/server";

export const VerifyPage = async ({ searchParams }) => {
  const t = await getTranslate();
  const { token } = await searchParams;

  return token ? (
    <FormWrapper>
      <p className="text-center">{t("auth.verify.verifying")}</p>
      <SignIn token={token} />
    </FormWrapper>
  ) : (
    <p className="text-center">{t("auth.verify.no_token_provided")}</p>
  );
};
