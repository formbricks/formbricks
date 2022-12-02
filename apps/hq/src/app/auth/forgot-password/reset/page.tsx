"use client";

import { useSearchParams } from "next/navigation";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  return (
    <>
      <ResetPasswordForm token={searchParams.get("token")} />
    </>
  );
}
