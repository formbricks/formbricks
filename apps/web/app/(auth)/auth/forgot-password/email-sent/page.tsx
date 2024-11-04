import { BackToLoginButton } from "@/app/(auth)/auth/components/BackToLoginButton";
import { FormWrapper } from "@/app/(auth)/auth/components/FormWrapper";
import { getTranslations } from "next-intl/server";

const Page = async () => {
  const t = await getTranslations();
  return (
    <FormWrapper>
      <div>
        <h1 className="leading-2 mb-4 text-center font-bold">
          {t("auth.forgot-password.email-sent.heading")}
        </h1>
        <p className="text-center">{t("auth.forgot-password.email-sent.text")}</p>
        <div className="mt-5 text-center">
          <BackToLoginButton />
        </div>
      </div>
    </FormWrapper>
  );
};

export default Page;
