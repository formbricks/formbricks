import { PasswordResetForm } from "./RequestPasswordResetForm";
import FormWrapper from "@/app/(auth)/auth/FormWrapper";

const ForgotPasswordPage: React.FC = () => {
  return (
    <FormWrapper>
      <PasswordResetForm />
    </FormWrapper>
  );
};

export default ForgotPasswordPage;
