import BackToLoginButton from "@/components/auth/BackToLoginButton";
import FormWrapper from "@/components/auth/FormWrapper";

export default function SignupWithoutVerificationSuccess() {
  return (
    <FormWrapper>
      <h1 className="leading-2 mb-4 text-center font-bold">User successfully created</h1>
      <p className="text-center">
        Your new user has been created successfully. Please click the button below and sign in to your
        account.
      </p>
      <hr className="my-4" />
      <BackToLoginButton />
    </FormWrapper>
  );
}
