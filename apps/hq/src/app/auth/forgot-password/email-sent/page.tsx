import { Button } from "@formbricks/ui";
import Link from "next/link";

export default function SignInPage() {
  return (
    <>
      <h1 className="leading-2 mb-4 text-center font-bold">Password reset successfully requested</h1>
      <p className="text-center">
        Check your email for a link to reset your password. If it doesn&apos;t appear within a few minutes,
        check your spam folder.
      </p>
      <div className="mt-5 text-center">
        <Button variant="secondary" href="/auth/signin" className="w-full justify-center">
          Back to login
        </Button>
      </div>
    </>
  );
}
