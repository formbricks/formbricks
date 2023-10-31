import FormWrapper from "@/app/(auth)/auth/components/FormWrapper";
import { ResetPasswordForm } from "@/app/(auth)/auth/forgot-password/reset/components/ResetPasswordForm";

const ResetPasswordPage: React.FC = () => {
  return (
    <FormWrapper>
      <ResetPasswordForm />
    </FormWrapper>
  );
};

export default ResetPasswordPage;
