import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { SignIn } from "@/modules/auth/verify/components/sign-in";
import { getTranslate } from "@/tolgee/server";

export const VerifyPage = async ({ searchParams }) => {
  const t = await getTranslate();
  return searchParams && searchParams.token ? (
    <FormWrapper>
      <p className="text-center">{t("auth.verify.verifying")}</p>
      <SignIn token={searchParams.token} />
    </FormWrapper>
  ) : (
    <p className="text-center">{t("auth.verify.no_token_provided")}</p>
  );
};
