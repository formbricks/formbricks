import { BackToLoginButton } from "@/app/(auth)/auth/components/BackToLoginButton";
import { FormWrapper } from "@/app/(auth)/auth/components/FormWrapper";
import { getTranslations } from "next-intl/server";

const Page = async () => {
  const t = await getTranslations();
  return (
    <FormWrapper>
      <div>
        <h1 className="leading-2 mb-4 text-center font-bold">
          {t("auth.forgot-password.reset.success.heading")}
        </h1>
        <p className="text-center">{t("auth.forgot-password.reset.success.text")}</p>
        <div className="mt-3 text-center">
          <BackToLoginButton />
        </div>
      </div>
    </FormWrapper>
  );
};

export default Page;
