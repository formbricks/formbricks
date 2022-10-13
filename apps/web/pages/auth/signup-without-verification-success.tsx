import Image from "next/image";
import { useRouter } from "next/router";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";

export default function SignupWithoutVerificationSuccess() {
  const router = useRouter();

  return (
    <BaseLayoutUnauthorized title="Verify your email">
      <div className="bg-ui-gray-light flex min-h-screen">
        <div className="mx-auto flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="shadow-cont mx-auto w-full max-w-sm rounded-xl bg-white p-8 lg:w-96">
            <div>
              <Image src="/img/snoopforms-logo.svg" alt="snoopForms logo" width={500} height={89} />
            </div>

            <div className="mt-8">
              <h1 className="leading-2 mb-4 text-center font-bold">User successfully created</h1>
              <p className="text-center">
                Your new user has been created successfully. Please click the button below and sign in to your
                account.
              </p>
              <hr className="my-4" />
              <button
                type="button"
                onClick={() => router.push("/")}
                className="mt-5 flex w-full justify-center rounded-md border border-gray-400 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
                Login
              </button>
            </div>
          </div>
        </div>
      </div>
    </BaseLayoutUnauthorized>
  );
}
