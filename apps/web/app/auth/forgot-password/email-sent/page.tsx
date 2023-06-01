import BackToLoginButton from "@/components/auth/BackToLoginButton";
import FormWrapper from "@/components/auth/FormWrapper";

const SignInPage: React.FC = () => {
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

export default SignInPage;
