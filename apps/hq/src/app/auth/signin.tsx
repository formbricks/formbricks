import { XCircleIcon } from "@heroicons/react/24/solid";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Logo } from "../Logo";

export default function SignInPage() {
  const router = useRouter();
  const { error } = router.query;

  const handleSubmit = async (e) => {
    e.preventDefault();
    await signIn("credentials", {
      callbackUrl: router.query.callbackUrl?.toString() || "/projects",
      email: e.target.elements.email.value,
      password: e.target.elements.password.value,
    });
  };
  return (
    <>
      <div className="flex min-h-screen bg-slate-100">
        <div className="mx-auto flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          {error && (
            <div className="absolute top-10 rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">An error occurred when logging you in</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p className="space-y-1 whitespace-pre-wrap">{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="shadow-cont mx-auto w-full max-w-sm rounded-xl bg-white p-8 lg:w-96">
            <div>
              <Logo className="fill-zinc-900" />
            </div>

            <div className="mt-8">
              <div className="mt-6">
                <form
                  onSubmit={handleSubmit}
                  method="post"
                  action="/api/auth/callback/credentials"
                  className="space-y-6">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-800">
                      Email address
                    </label>
                    <div className="mt-1">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="ph-no-capture block w-full appearance-none rounded-md border border-slate-300 px-3 py-2 placeholder-slate-300 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500 sm:text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-800">
                      Password
                    </label>
                    <div className="mt-1">
                      <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        className="ph-no-capture block w-full appearance-none rounded-md border border-slate-300 px-3 py-2 placeholder-slate-300 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500 sm:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="bg-red flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
                      Sign in
                    </button>
                    <div className="text-red mt-3 text-center text-xs hover:text-red-600">
                      {process.env.NEXT_PUBLIC_PASSWORD_RESET_DISABLED !== "1" && (
                        <div>
                          <Link href="/auth/forgot-password" id="forgot-password">
                            Forgot your password?
                          </Link>
                        </div>
                      )}

                      {process.env.NEXT_PUBLIC_SIGNUP_DISABLED !== "1" && (
                        <div>
                          <Link href="/auth/signup" id="create-account">
                            Create an account
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
