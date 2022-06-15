import { getCsrfToken } from "next-auth/react";
import { useRouter } from "next/router";
import { XCircleIcon } from "@heroicons/react/solid";
import { GetServerSideProps } from "next";

interface props {
  csrfToken: string;
}

export default function SignIn({ csrfToken }: props) {
  const router = useRouter();
  const { error } = router.query;
  return (
    <div className="flex min-h-screen bg-white">
      <div className="flex flex-col justify-center flex-1 px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        {error && (
          <div className="absolute p-4 rounded-md top-10 bg-red-50">
            <div className="flex">
              <div className="flex-shrink-0">
                <XCircleIcon
                  className="w-5 h-5 text-red-400"
                  aria-hidden="true"
                />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  An error occurred when logging you in
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p className="space-y-1 whitespace-pre-wrap">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-sm mx-auto lg:w-96">
          <div>
            <h1 className="text-lg font-bold text-red-500">snoopForms</h1>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Sign in
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Sign in to your account
            </p>
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
                    className="block text-sm font-medium text-gray-700"
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
                      className="block w-full px-3 py-2 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700"
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
                      className="block w-full px-3 py-2 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
                  >
                    Sign in
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <div className="relative flex-1 hidden w-0 lg:block">
        <img
          className="absolute inset-0 object-cover w-full h-full"
          src="https://images.unsplash.com/photo-1605362001336-f91645086f32?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1908&q=80"
          alt=""
        />
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
