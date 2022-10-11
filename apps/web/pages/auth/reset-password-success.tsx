import Image from "next/image";
import Link from "next/link";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";

export default function ResetPasswordSuccess() {
  return (
    <BaseLayoutUnauthorized title="Reset password success">
      <div className="bg-ui-gray-light flex min-h-screen">
        <div className="mx-auto flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="shadow-cont mx-auto w-full max-w-sm rounded-xl bg-white p-8 lg:w-96">
            <div>
              <Image src="/img/snoopforms-logo.svg" alt="snoopForms logo" width={500} height={89} />
            </div>

            <div className="mt-8">
              <h1 className="leading-2 mb-4 text-center font-bold">Password successfully reset</h1>
              <p className="text-center">You can now log in with your new password</p>
              <div className="mt-3 text-center">
                <Link href="/auth/signin">
                  <a href="" className="text-red block text-xs hover:text-red-600">
                    Go to login
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
