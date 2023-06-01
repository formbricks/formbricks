import { PasswordResetForm } from "../../../components/auth/PasswordResetForm";
import FormWrapper from "@/components/auth/FormWrapper";

const ForgotPasswordPage: React.FC = () => {
  return (
    <FormWrapper>
      <PasswordResetForm />
    </FormWrapper>
  );
};

export default ForgotPasswordPage;
