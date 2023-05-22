import BackToLoginButton from "@/components/auth/BackToLoginButton";
import FormWrapper from "@/components/auth/FormWrapper";

export default function ResetPasswordSuccessPage() {
  return (
    <FormWrapper>
      <div>
        <h1 className="leading-2 mb-4 text-center font-bold">Password successfully reset</h1>
        <p className="text-center">You can now log in with your new password</p>
        <div className="mt-3 text-center">
          <BackToLoginButton />
        </div>
      </div>
    </FormWrapper>
  );
}
