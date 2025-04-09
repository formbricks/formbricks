import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { Metadata } from "next";
import { EMAIL_AUTH_ENABLED, PASSWORD_RESET_DISABLED, SIGNUP_ENABLED } from "@formbricks/lib/constants";
import { LoginForm } from "./components/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Open-source Experience Management. Free & open source.",
};

export const LoginPage = async () => {
  const [isMultiOrgEnabled] = await Promise.all([false]);

  return (
    <div className="grid min-h-screen w-full bg-gradient-to-tr from-slate-100 to-slate-50">
      <div className="flex flex-col items-center justify-center">
        <FormWrapper>
          <LoginForm
            emailAuthEnabled={EMAIL_AUTH_ENABLED}
            publicSignUpEnabled={SIGNUP_ENABLED}
            passwordResetEnabled={!PASSWORD_RESET_DISABLED}
            isMultiOrgEnabled={isMultiOrgEnabled}
          />
        </FormWrapper>
      </div>
    </div>
  );
};
