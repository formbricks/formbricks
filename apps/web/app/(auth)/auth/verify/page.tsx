"use client";

import { FormWrapper } from "@/app/(auth)/auth/components/FormWrapper";
import { SignIn } from "@/app/(auth)/auth/verify/components/SignIn";
import { getTranslations } from "next-intl/server";
import { useSearchParams } from "next/navigation";

const Page = async () => {
  const t = await getTranslations();
  const searchParams = useSearchParams();
  return searchParams && searchParams?.get("token") ? (
    <FormWrapper>
      <p className="text-center">{t("auth.verify.verifying")}</p>
      <SignIn token={searchParams.get("token")} />
    </FormWrapper>
  ) : (
    <p className="text-center">{t("auth.verify.no_token_provided")}</p>
  );
};

export default Page;
