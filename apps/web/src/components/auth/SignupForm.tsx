"use client";

import { createUser } from "@/lib/users";
import { Button } from "@formbricks/ui";
import { XCircleIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GithubButton } from "./GithubButton";

export const SignupForm = () => {
  const router = useRouter();
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createUser(
        e.target.elements.name.value,
        e.target.elements.email.value,
        e.target.elements.password.value
      );
      const url =
        process.env.NEXT_PUBLIC_EMAIL_VERIFICATION_DISABLED === "1"
          ? `/auth/signup-without-verification-success`
          : `/auth/verification-requested?email=${encodeURIComponent(e.target.elements.email.value)}`;

      router.push(url);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      {error && (
        <div className="absolute top-10 rounded-md bg-teal-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircleIcon className="h-5 w-5 text-teal-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-teal-800">An error occurred when logging you in</h3>
              <div className="mt-2 text-sm text-teal-700">
                <p className="space-y-1 whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-800">
            Full Name
          </label>
          <div className="mt-1">
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="given-name"
              required
              className="focus:border-brand focus:ring-brand block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
            />
          </div>
        </div>
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
              className="focus:border-brand focus:ring-brand block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
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
              required
              className="focus:border-brand focus:ring-brand block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
            />
          </div>
        </div>

        <div>
          <Button type="submit" className="w-full justify-center">
            Sign up
          </Button>

          <div className="mt-3 text-center text-xs text-gray-600">
            Already have an account?{" "}
            <Link href="/auth/signin" className="text-brand hover:text-brand-light">
              Log in.
            </Link>
          </div>
          {(process.env.NEXT_PUBLIC_TERMS_URL || process.env.NEXT_PUBLIC_PRIVACY_URL) && (
            <div className="mt-3 text-center text-xs text-gray-400">
              By clicking &quot;Sign Up&quot;, you agree to our
              <br />
              {process.env.NEXT_PUBLIC_TERMS_URL && (
                <Link
                  className="text-brand hover:text-brand-light underline"
                  href={process.env.NEXT_PUBLIC_TERMS_URL}
                  rel="noreferrer"
                  target="_blank">
                  terms of service
                </Link>
              )}
              {process.env.NEXT_PUBLIC_TERMS_URL && process.env.NEXT_PUBLIC_PRIVACY_URL && <span> and </span>}
              {process.env.NEXT_PUBLIC_PRIVACY_URL && (
                <Link
                  className="text-brand hover:text-brand-light underline"
                  href={process.env.NEXT_PUBLIC_PRIVACY_URL}
                  rel="noreferrer"
                  target="_blank">
                  privacy policy
                </Link>
              )}
              .<br />
              We&apos;ll occasionally send you account related emails.
            </div>
          )}
        </div>
        {process.env.NEXT_PUBLIC_GITHUB_AUTH_ENABLED === "1" && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-2 text-sm text-gray-500">Sign up with</span>
              </div>
            </div>
            <GithubButton text="Sign up with GitHub" />
          </>
        )}
      </form>
    </>
  );
};
