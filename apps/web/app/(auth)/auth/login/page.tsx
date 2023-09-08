import { env } from "@/env.mjs";
import { SigninForm } from "@/components/auth/SigninForm";
import Testimonial from "@/components/auth/Testimonial";
import FormWrapper from "@/components/auth/FormWrapper";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Open-source Experience Management. Free & open source.",
};

export default function SignInPage() {
  const publicSignUpDisabled = env.SIGNUP_DISABLED;
  const passwordResetDisabled = env.PASSWORD_RESET_DISABLED;
  return (
    <div className="grid min-h-screen w-full bg-gradient-to-tr from-slate-100 to-slate-50 lg:grid-cols-5">
      <div className="col-span-2 hidden lg:flex">
        <Testimonial />
      </div>
      <div className="col-span-3 flex flex-col items-center justify-center">
        <FormWrapper>
          <SigninForm
            publicSignUpDisabled={publicSignUpDisabled}
            passwordResetDisabled={passwordResetDisabled}
          />
        </FormWrapper>
      </div>
    </div>
  );
}
