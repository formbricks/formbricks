"use client";

import { SignIn } from "@/components/auth/SignIn";
import LayoutAuth from "@/components/layout/LayoutAuth";
import { useRouter } from "next/router";

export default function Verify() {
  const router = useRouter();
  return (
    <LayoutAuth title="Verify">
      <p className="text-center">{!router.query.token ? "No Token provided" : "Verifying..."}</p>
      <SignIn token={router.query.token} />
    </LayoutAuth>
  );
}
