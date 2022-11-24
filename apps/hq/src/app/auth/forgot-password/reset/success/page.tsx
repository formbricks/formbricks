import { Button } from "@formbricks/ui";

export default function ResetPasswordSuccessPage() {
  return (
    <>
      <h1 className="leading-2 mb-4 text-center font-bold">Password successfully reset</h1>
      <p className="text-center">You can now log in with your new password</p>
      <div className="mt-3 text-center">
        <Button href="/auth/signin" className="w-full justify-center">
          Go to login
        </Button>
      </div>
    </>
  );
}
