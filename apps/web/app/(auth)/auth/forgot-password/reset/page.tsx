import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import FormWrapper from "@/app/(auth)/auth/FormWrapper";

const ResetPasswordPage: React.FC = () => {
  return (
    <FormWrapper>
      <ResetPasswordForm />
    </FormWrapper>
  );
};

export default ResetPasswordPage;
