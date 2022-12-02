"use client";

import { useSearchParams } from "next/navigation";
import { SignIn } from "./SignIn";

export default function Verify() {
  const searchParams = useSearchParams();
  return (
    <>
      <p className="text-center">{!searchParams.get("token") ? "No Token provided" : "Verifying..."}</p>
      <SignIn token={searchParams.get("token")} />
    </>
  );
}
