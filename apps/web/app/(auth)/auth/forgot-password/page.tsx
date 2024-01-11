import FormWrapper from "@/app/(auth)/auth/components/FormWrapper";
import { PasswordResetForm } from "@/app/(auth)/auth/forgot-password/components/PasswordResetForm";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";

const ForgotPasswordPage: React.FC = async () => {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect(`/`);
  }

  return (
    <FormWrapper>
      <PasswordResetForm />
    </FormWrapper>
  );
};

export default ForgotPasswordPage;
