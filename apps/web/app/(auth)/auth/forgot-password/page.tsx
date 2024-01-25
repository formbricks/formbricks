import FormWrapper from "@/app/(auth)/auth/components/FormWrapper";
import { PasswordResetForm } from "@/app/(auth)/auth/forgot-password/components/PasswordResetForm";

const ForgotPasswordPage: React.FC = () => {
  return (
    <FormWrapper>
      <PasswordResetForm />
    </FormWrapper>
  );
};

export default ForgotPasswordPage;
