import { BackToLoginButton } from "@/modules/auth/components/back-to-login-button";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { EmailChangeSignIn } from "@/modules/auth/verify-email-change/components/email-change-sign-in";

export const VerifyEmailChangePage = async ({ searchParams }) => {
  const { token } = await searchParams;

  return (
    <FormWrapper>
      <EmailChangeSignIn token={token} />
      <BackToLoginButton />
    </FormWrapper>
  );
};
