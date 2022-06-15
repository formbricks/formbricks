import { getCsrfToken } from "next-auth/react";
import { useRouter } from "next/router";
import { XCircleIcon } from "@heroicons/react/solid";
import { GetServerSideProps } from "next";
import Image from "next/image";

interface props {
  csrfToken: string;
}

export default function SignIn({ csrfToken }: props) {
  const router = useRouter();
  const { error } = router.query;
  return (
    <div className="flex min-h-screen bg-lightgray-200">
      <div className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        {error && (
          <div className="absolute p-4 rounded-md top-10 bg-snoopred-50">
            <div className="flex">
              <div className="flex-shrink-0">
                <XCircleIcon
                  className="w-5 h-5 text-snoopred-400"
                  aria-hidden="true"
                />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-snoopred-800">
                  An error occurred when logging you in
                </h3>
                <div className="mt-2 text-sm text-snoopred-700">
                  <p className="space-y-1 whitespace-pre-wrap">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

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
            <div className="mt-6">
              <form
                method="post"
                action="/api/auth/callback/credentials"
                className="space-y-6"
              >
                <input
                  name="csrfToken"
                  type="hidden"
                  defaultValue={csrfToken}
                />
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-darkgray-500"
                  >
                    Email address
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-lightgray-400 border-lightgray-300 focus:outline-none focus:ring-snoopred-500 focus:border-snoopred-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-darkgray-500"
                  >
                    Password
                  </label>
                  <div className="mt-1">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-lightgray-400 border-lightgray-300 focus:outline-none focus:ring-snoopred-500 focus:border-snoopred-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm bg-snoopred hover:bg-snoopred-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-snoopred-500"
                  >
                    Sign in
                  </button>
                  <div className="text-center">
                    <a
                      href=""
                      className="text-xs text-snoopred hover:text-snoopred-600"
                    >
                      Create an account
                    </a>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const csrfToken = await getCsrfToken(context);
  return {
    props: { csrfToken },
  };
};
