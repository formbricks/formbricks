import { Metadata } from "next";
import { getTranslate } from "@/lingodotdev/server";
import { AuthCard } from "@/modules/auth/components/auth-card";
import { AuthHeading } from "@/modules/auth/components/auth-heading";
import { SignupFormLoader } from "@/modules/auth/signup/components/signup-form-loader";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Open-source Experience Management. Free & open source.",
};

export const SignupPage = async () => {
  const t = await getTranslate();

  return (
    <AuthCard>
      <AuthHeading
        title={t("setup.signup.create_administrator")}
        description={t("setup.signup.this_user_has_all_the_power")}
      />
      <SignupFormLoader />
    </AuthCard>
  );
};
