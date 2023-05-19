import { SigninForm } from "@/components/auth/SigninForm";
import Testimonial from "@/components/auth/Testimonial";
import FormWrapper from "@/components/auth/FormWrapper";

export default function SignInPage() {
  return (
    <div className="grid min-h-screen w-full bg-gradient-to-tr from-slate-200 to-slate-50 lg:grid-cols-2">
      <div className="hidden lg:flex">
        <Testimonial />
      </div>
      <FormWrapper>
        <SigninForm />
      </FormWrapper>
    </div>
  );
}
