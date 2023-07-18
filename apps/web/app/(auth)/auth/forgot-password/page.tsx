import { PasswordResetForm } from "@/components/auth/RequestPasswordResetForm";
import FormWrapper from "@/components/auth/FormWrapper";

const ForgotPasswordPage: React.FC = () => {
  return (
    <FormWrapper>
      <PasswordResetForm />
    </FormWrapper>
  );
};

export default ForgotPasswordPage;
