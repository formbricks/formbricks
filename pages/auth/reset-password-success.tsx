import Image from "next/image";
import Link from "next/link";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";

export default function ResetPasswordSuccess() {
  return (
    <BaseLayoutUnauthorized title="Reset password success">
      <div className="flex min-h-screen bg-ui-gray-light">
        <div
          className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="w-full max-w-sm p-8 mx-auto bg-white rounded-xl shadow-cont lg:w-96">
            <div>
              <Image
                src="/img/snoopforms-logo.svg"
                alt="snoopForms logo"
                width={500}
                height={89}
              />
            </div>

            <div className="mt-8">
              <h1 className="mb-4 font-bold text-center leading-2">
                Password successfully reset
              </h1>
              <p className="text-center">
                You can now log in with your new password
              </p>
              <div className="mt-3 text-center">
                <Link href="/auth/signin">
                  <a
                    href=""
                    className="text-xs text-red hover:text-red-600 block"
                  >
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
