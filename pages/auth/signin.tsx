import { XCircleIcon } from "@heroicons/react/24/solid";
import { signIn } from "next-auth/react";
import getConfig from "next/config";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";

const { publicRuntimeConfig } = getConfig();
const { passwordResetDisabled } = publicRuntimeConfig;

export default function SignInPage() {
  const router = useRouter();
  const { error } = router.query;

  const handleSubmit = async (e) => {
    e.preventDefault();
    await signIn("credentials", {
      callbackUrl: router.query.callbackUrl?.toString() || "/forms", //UserRole.PUBLIC?'/forms': '/f/sourcings',
      email: e.target.elements.email.value,
      password: e.target.elements.password.value,
    });
  };
  return (
    <BaseLayoutUnauthorized title="Sign in">
      <div className="flex min-h-screen bg-ui-gray-light">
        <div className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          {error && (
            <div className="absolute p-4 rounded-md top-10 bg-red-50 z-50">
              <div className="flex">
                <div className="flex-shrink-0">
                  <XCircleIcon
                    className="w-5 h-5 text-red-400"
                    aria-hidden="true"
                  />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Une erreur s&apos;est produite lors de votre connexion
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p className="space-y-1 whitespace-pre-wrap">{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="w-full max-w-sm p-8 mx-auto bg-white rounded-xl shadow-cont lg:w-96">
            <div className="w-fit m-auto">
              <Image
                src="/img/kadea_logo.png"
                alt="Kadea  academy logo"
                width={180}
                height={40}
              />
            </div>
            <div className="mt-8">
              <div className="mt-6">
                <form
                  onSubmit={handleSubmit}
                  method="post"
                  action="/api/auth/callback/credentials"
                  className="space-y-6"
                >
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-ui-gray-dark"
                    >
                      Adresse E-mail
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
                      Mot de passe
                    </label>
                    <div className="mt-1">
                      <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                      />
                    </div>
                  </div>

                  <div className="text-center">
                    <button
                      type="submit"
                      className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm bg-red hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 mb-3"
                    >
                      Se connecter
                    </button>
                    <span className="text-center text-ui-gray-dark overflow-hidden before:h-[2px] after:h-[2px] after:bg-gray after:inline-block after:relative after:align-middle after:w-1/3 before:bg-gray before:inline-block before:relative before:align-middle before:w-1/3 before:right-2 after:left-2 text-xs mt-3">
                      OU
                    </span>

                    <Link
                      href={{
                        pathname: "/auth/signup",
                        query: {
                          callbackUrl:
                            router.query.callbackUrl?.toString() || "/forms",
                        },
                      }}
                    >
                      <a href="">
                        <button className="flex justify-center w-full px-4 py-2 text-sm font-medium text-slate-900 border-2 border-red-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 mt-3 hover:bg-red-600 hover:text-white hover:border-red-600">
                          Créer un compte
                        </button>
                      </a>
                    </Link>

                    {passwordResetDisabled && (
                      <Link href="/auth/forgot-password">
                        <a
                          href=""
                          className="mt-3 block text-xs text-red hover:text-red-600"
                        >
                          Mot de passe oublié?
                        </a>
                      </Link>
                    )}
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
