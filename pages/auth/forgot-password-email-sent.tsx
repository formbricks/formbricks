import Image from "next/image";
import Link from "next/link";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";

export default function ForgotPasswordEmailSent() {
  return (
    <BaseLayoutUnauthorized title="Forgot password email sent">
      <div className="flex min-h-screen bg-ui-gray-light">
        <div className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="w-full max-w-sm p-8 mx-auto bg-white rounded-xl shadow-cont lg:w-96">
            <div className="w-fit m-auto">
              <Image
                src="/img/kda_logo.png"
                alt="kinshasa digital academy logo"
                width={180}
                height={60}
              />
            </div>

            <div className="mt-8">
              <h1 className="mb-4 font-bold text-center leading-2">
                Password reset successfully requested
              </h1>
              <p className="text-center">
                Check your email for a link to reset your password. If it
                doesn&apos;t appear within a few minutes, check your spam
                folder.
              </p>
              <div className="mt-3 text-center">
                <Link href="/auth/signin">
                  <a
                    href=""
                    className="text-xs text-red hover:text-red-600 block"
                  >
                    Back to login
                  </a>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BaseLayoutUnauthorized>
  );
}
