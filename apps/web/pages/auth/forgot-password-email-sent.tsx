import Image from "next/legacy/image";
import Link from "next/link";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";

export default function ForgotPasswordEmailSent() {
  return (
    <BaseLayoutUnauthorized title="Forgot password email sent">
      <div className="bg-ui-gray-light flex min-h-screen">
        <div className="mx-auto flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="shadow-cont mx-auto w-full max-w-sm rounded-xl bg-white p-8 lg:w-96">
            <div>
              <Image src="/img/snoopforms-logo.svg" alt="snoopForms logo" width={500} height={89} />
            </div>

            <div className="mt-8">
              <h1 className="leading-2 mb-4 text-center font-bold">Password reset successfully requested</h1>
              <p className="text-center">
                Check your email for a link to reset your password. If it doesn&apos;t appear within a few
                minutes, check your spam folder.
              </p>
              <div className="mt-3 text-center">
                <Link href="/auth/signin" className="text-red block text-xs hover:text-red-600">
                  Back to login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BaseLayoutUnauthorized>
  );
}
