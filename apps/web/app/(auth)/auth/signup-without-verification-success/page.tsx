import { BackToLoginButton } from "@/app/(auth)/auth/components/BackToLoginButton";
import { FormWrapper } from "@/app/(auth)/auth/components/FormWrapper";
import { getTranslations } from "next-intl/server";

const Page = async () => {
  const t = await getTranslations();
  return (
    <FormWrapper>
      <h1 className="leading-2 mb-4 text-center font-bold">
        {t("auth.signup_without_verification_success.user_successfully_created")}
      </h1>
      <p className="text-center text-sm">
        {t("auth.signup_without_verification_success.user_successfully_created_description")}
      </p>
      <hr className="my-4" />
      <BackToLoginButton />
    </FormWrapper>
  );
};

export default Page;
