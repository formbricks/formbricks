import { SigninForm } from "@/components/auth/SigninForm";
import Testimonial from "@/components/auth/Testimonial";
import FormWrapper from "@/components/auth/FormWrapper";

export default function SignInPage() {
  return (
    <div className="grid min-h-screen w-full grid-cols-2 bg-gradient-to-tr from-slate-200 to-slate-50">
      <Testimonial />
      <FormWrapper>
        <SigninForm />
      </FormWrapper>
    </div>
  );
}
