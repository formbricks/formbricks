import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { SignIn } from "@/modules/auth/verify/components/sign-in";
import { getTranslations } from "next-intl/server";

interface VerifyPageProps {
  searchParams: {
    token: string;
  };
}

export const VerifyPage = async ({ searchParams }: VerifyPageProps) => {
  const t = await getTranslations();
  return searchParams && searchParams.token ? (
    <FormWrapper>
      <p className="text-center">{t("auth.verify.verifying")}</p>
      <SignIn token={searchParams.token} />
    </FormWrapper>
  ) : (
    <p className="text-center">{t("auth.verify.no_token_provided")}</p>
  );
};
