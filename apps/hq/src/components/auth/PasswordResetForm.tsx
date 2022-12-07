"use client";

import { forgotPassword } from "@/lib/users";
import { Button } from "@formbricks/ui";
import { XCircleIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const PasswordResetForm = ({}) => {
  const router = useRouter();
  const [error, setError] = useState<string>("");
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await forgotPassword(e.target.elements.email.value);

      router.push("/auth/forgot-password/email-sent");
    } catch (e) {
      setError(e.message);
    }
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
          <Button type="submit" className="w-full justify-center">
            Send password reset email
          </Button>
          <div className="mt-3 text-center">
            <Button variant="secondary" href="/auth/signin" className="w-full justify-center">
              Back to login
            </Button>
          </div>
        </div>
      </form>
    </>
  );
};
