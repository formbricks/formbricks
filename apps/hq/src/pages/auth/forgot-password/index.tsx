import LayoutAuth from "@/components/layout/LayoutAuth";
import { PasswordResetForm } from "../../../components/auth/PasswordResetForm";

export default function ForgotPasswordPage() {
  return (
    <LayoutAuth title="Forgot password">
      <PasswordResetForm />
    </LayoutAuth>
  );
}
