"use client";

import { Button } from "@formbricks/ui";
import { XCircleIcon } from "@heroicons/react/20/solid";
import { signIn } from "next-auth/react";
import Link from "next/dist/client/link";
import { GithubButton } from "../GithubButton";

export const SigninForm = ({ callbackUrl, error }) => {
  const handleSubmit = async (e) => {
    e.preventDefault();
    await signIn("credentials", {
      callbackUrl: callbackUrl || "/projects",
      email: e.target.elements.email.value,
      password: e.target.elements.password.value,
    });
  };

  return (
    <>
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
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="text-ui-gray-dark block text-sm font-medium">
            Email address
          </label>
          <div className="mt-1">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="focus:border-brand focus:ring-brand block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
            />
          </div>
        </div>
        <div>
          <label htmlFor="email" className="text-ui-gray-dark block text-sm font-medium">
            Password
          </label>
          <div className="mt-1">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="focus:border-brand focus:ring-brand block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
            />
          </div>
        </div>

        <div>
          <Button type="submit" className="w-full justify-center">
            Sign in
          </Button>
        </div>
        {process.env.NEXT_PUBLIC_PASSWORD_RESET_DISABLED !== "1" && (
          <div>
            <Link
              href="/auth/forgot-password"
              className="text-sky mt-3 grid grid-cols-1 space-y-2 text-center text-xs hover:text-sky-600">
              Forgot your password?
            </Link>
          </div>
        )}
        {process.env.NEXT_PUBLIC_GITHUB_AUTH_ENABLED === "1" && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-2 text-sm text-gray-500">Sign in with</span>
              </div>
            </div>
            <GithubButton text="Sign in with GitHub" />{" "}
          </>
        )}
      </form>
    </>
  );
};
