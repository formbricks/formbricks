import { BackToLoginButton } from "@/app/(auth)/auth/components/BackToLoginButton";
import { FormWrapper } from "@/app/(auth)/auth/components/FormWrapper";

const Page = () => {
  return (
    <FormWrapper>
      <div>
        <h1 className="leading-2 mb-4 text-center font-bold">Password reset successfully requested</h1>
        <p className="text-center">
          Check your email for a link to reset your password. If it doesn&apos;t appear within a few minutes,
          check your spam folder.
        </p>
        <div className="mt-5 text-center">
          <BackToLoginButton />
        </div>
      </div>
    </FormWrapper>
  );
};

export default Page;
