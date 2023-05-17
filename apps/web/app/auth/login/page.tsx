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
        {process.env.NEXT_PUBLIC_SIGNUP_DISABLED !== "1" && (
          <div>
            <Link
              href="/auth/signup"
              className="hover:text-brand-dark mt-3 grid grid-cols-1 space-y-2 text-center text-xs text-slate-700">
              Need an account? Register instead.
            </Link>
          </div>
        )}
      </FormWrapper>
    </div>
  );
}
