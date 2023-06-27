"use client";

import { GoogleButton } from "@/components/auth/GoogleButton";
import { Button, PasswordInput } from "@formbricks/ui";
import { XCircleIcon } from "@heroicons/react/24/solid";
import { signIn } from "next-auth/react";
import Link from "next/dist/client/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { GithubButton } from "./GithubButton";

export const SigninForm = () => {
  const searchParams = useSearchParams();
  const emailRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e) => {
    setLoggingIn(true);
    e.preventDefault();
    await signIn("credentials", {
      callbackUrl: searchParams?.get("callbackUrl") || "/",
      email: e.target.elements.email.value,
      password: e.target.elements.password.value,
    });
  };

  const [loggingIn, setLoggingIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isButtonEnabled, setButtonEnabled] = useState(true);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const checkFormValidity = () => {
    // If both fields are filled, enable the button
    if (formRef.current) {
      setButtonEnabled(formRef.current.checkValidity());
    }
  };

  return (
    <>
      <div className="text-center">
        <h1 className="mb-4 text-slate-700">Log in to your account</h1>
        <div className="space-y-2">
          <form onSubmit={handleSubmit} ref={formRef} className="space-y-2" onChange={checkFormValidity}>
            {showLogin && (
              <div>
                <div className="mb-2 transition-all duration-500 ease-in-out">
                  <label htmlFor="email" className="sr-only">
                    Email address
                  </label>
                  <input
                    ref={emailRef}
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="work@email.com"
                    defaultValue={searchParams?.get("email") || ""}
                    className="focus:border-brand focus:ring-brand block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
                  />
                </div>
                <div className="transition-all duration-500 ease-in-out">
                  <label htmlFor="password" className="sr-only">
                    Password
                  </label>
                  <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="*******"
                    aria-placeholder="password"
                    onFocus={() => setIsPasswordFocused(true)}
                    required
                    className="focus:border-brand focus:ring-brand block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
                  />
                </div>
                {process.env.NEXT_PUBLIC_PASSWORD_RESET_DISABLED !== "1" && isPasswordFocused && (
                  <div className="ml-1 text-right transition-all duration-500 ease-in-out">
                    <Link
                      href="/auth/forgot-password"
                      className="hover:text-brand-dark text-xs text-slate-500">
                      Forgot your password?
                    </Link>
                  </div>
                )}
              </div>
            )}
            <Button
              onClick={() => {
                if (!showLogin) {
                  setShowLogin(true);
                  setButtonEnabled(false);
                  // Add a slight delay before focusing the input field to ensure it's visible
                  setTimeout(() => emailRef.current?.focus(), 100);
                } else if (formRef.current) {
                  formRef.current.requestSubmit();
                }
              }}
              variant="darkCTA"
              className="w-full justify-center"
              loading={loggingIn}
              disabled={!isButtonEnabled}>
              Login with Email
            </Button>
          </form>

          {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "1" && (
            <>
              <GoogleButton />
            </>
          )}
          {process.env.NEXT_PUBLIC_GITHUB_AUTH_ENABLED === "1" && (
            <>
              <GithubButton />
            </>
          )}
        </div>
        {process.env.NEXT_PUBLIC_SIGNUP_DISABLED !== "1" && (
          <div className="mt-9 text-center text-xs ">
            <span className="leading-5 text-slate-500">New to Formbricks?</span>
            <br />
            <Link href="/auth/signup" className="font-semibold text-slate-600 underline hover:text-slate-700">
              Create an account
            </Link>
          </div>
        )}
      </div>
      {searchParams?.get("error") && (
        <div className="absolute top-10 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">An error occurred when logging you in</h3>
              <div className="mt-2 text-sm text-red-700">
                <p className="space-y-1 whitespace-pre-wrap">{searchParams?.get("error")}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
