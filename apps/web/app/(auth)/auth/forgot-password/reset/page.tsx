import FormWrapper from "@/app/(auth)/auth/components/FormWrapper";
import { ResetPasswordForm } from "@/app/(auth)/auth/forgot-password/reset/components/ResetPasswordForm";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";

const ResetPasswordPage: React.FC = async () => {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect(`/`);
  }
  return (
    <FormWrapper>
      <ResetPasswordForm />
    </FormWrapper>
  );
};

export default ResetPasswordPage;
