"use client";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import LayoutAuth from "@/components/layout/LayoutAuth";
import { useRouter } from "next/router";

export default function ResetPasswordPage() {
  const router = useRouter();
  return (
    <LayoutAuth title="Reset password">
      <ResetPasswordForm token={router.query.token} />
    </LayoutAuth>
  );
}
