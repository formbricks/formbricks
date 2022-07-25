import { XCircleIcon } from "@heroicons/react/solid";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";
import { createUser } from "../../lib/users";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createUser(
        e.target.elements.firstname.value,
        e.target.elements.lastname.value,
        e.target.elements.email.value,
        e.target.elements.password.value
      );
      router.push(
        `/auth/verification-requested?email=${encodeURIComponent(
          e.target.elements.email.value
        )}`
      );
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <BaseLayoutUnauthorized title="Sign up">
      <div className="flex min-h-screen bg-ui-gray-light">
        <div className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
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
              <p className="text-sm text-center text-gray-600">
                Create your own forms and collect submissions by creating a
                snoopForms account.
              </p>
              <div className="mt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label
                      htmlFor="firstname"
                      className="block text-sm font-medium text-ui-gray-dark"
                    >
                      First name
                    </label>
                    <div className="mt-1">
                      <input
                        id="firstname"
                        name="firstname"
                        type="text"
                        autoComplete="given-name"
                        required
                        className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="lastname"
                      className="block text-sm font-medium text-ui-gray-dark"
                    >
                      Last name
                    </label>
                    <div className="mt-1">
                      <input
                        id="lastname"
                        name="lastname"
                        type="text"
                        autoComplete="family-name"
                        required
                        className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-ui-gray-dark"
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
                        className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-ui-gray-dark"
                    >
                      Password
                    </label>
                    <div className="mt-1">
                      <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm bg-red hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Sign up
                    </button>
                    <div className="mt-3 text-xs text-center text-gray-600">
                      Already have an account?{" "}
                      <Link href="/auth/signin">
                        <a className="text-red hover:text-red-600">Log in.</a>
                      </Link>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BaseLayoutUnauthorized>
  );
}
