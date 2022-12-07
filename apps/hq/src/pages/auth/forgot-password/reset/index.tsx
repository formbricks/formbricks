"use client";

import { useSearchParams } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import LayoutAuth from "@/components/layout/LayoutAuth";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  return (
    <LayoutAuth title="Reset password">
      <ResetPasswordForm token={searchParams.get("token")} />
    </LayoutAuth>
  );
}
