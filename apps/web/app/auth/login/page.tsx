import { SigninForm } from "@/components/auth/SigninForm";
import Testimonial from "@/components/auth/Testimonial";
import FormWrapper from "@/components/auth/FormWrapper";

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
