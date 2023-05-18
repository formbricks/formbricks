import { SigninForm } from "@/components/auth/SigninForm";
import Link from "next/link";
import Testimonial from "@/components/auth/Testimonial";
import FormWrapper from "@/components/auth/FormWrapper";

export default function SignInPage() {
  return (
    <div className="bg grid grid-cols-2 bg-gradient-to-tr from-slate-200 to-slate-50">
      <Testimonial />
      <FormWrapper>
        <SigninForm />
      </FormWrapper>
    </div>
  );
}
