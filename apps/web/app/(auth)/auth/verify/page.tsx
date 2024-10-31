import { FormWrapper } from "@/app/(auth)/auth/components/FormWrapper";
import { SignIn } from "@/app/(auth)/auth/verify/components/SignIn";
import { getTranslations } from "next-intl/server";

const Page = async ({ searchParams }) => {
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

export default Page;
