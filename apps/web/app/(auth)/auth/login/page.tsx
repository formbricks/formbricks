import Testimonial from "@/app/(auth)/auth/Testimonial";
import FormWrapper from "@/app/(auth)/auth/FormWrapper";
import { Metadata } from "next";
import { SigninForm } from "./SigninForm";

export const metadata: Metadata = {
  title: "Login",
  description: "Open-source Experience Management. Free & open source.",
};

export default function SignInPage() {
  return (
    <div className="grid min-h-screen w-full bg-gradient-to-tr from-slate-100 to-slate-50 lg:grid-cols-5">
      <div className="col-span-2 hidden lg:flex">
        <Testimonial />
      </div>
      <div className="col-span-3 flex flex-col items-center justify-center">
        <FormWrapper>
          <SigninForm />
        </FormWrapper>
      </div>
    </div>
  );
}
