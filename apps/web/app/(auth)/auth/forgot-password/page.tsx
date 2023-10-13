import { PasswordResetForm } from "@/app/components/auth/RequestPasswordResetForm";
import FormWrapper from "@/app/components/auth/FormWrapper";

const ForgotPasswordPage: React.FC = () => {
  return (
    <FormWrapper>
      <PasswordResetForm />
    </FormWrapper>
  );
};

export default ForgotPasswordPage;
