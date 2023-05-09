"use client";

import { resetPassword } from "@/lib/users/users";
import { Button } from "@formbricks/ui/Button";
import { XCircleIcon } from "@heroicons/react/24/solid";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export const ResetPasswordForm = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = searchParams?.get("token");
    try {
      if (!token) throw new Error("No token provided");
      await resetPassword(token, e.target.elements.password.value);

      router.push("/auth/forgot-password/reset/success");
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
            New password
          </label>
          <div className="mt-1">
            <input
              id="password"
              name="password"
              type="password"
              required
              className="focus:border-brand focus:ring-brand block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
            />
          </div>
        </div>

        <div>
          <Button type="submit" className="w-full justify-center">
            Reset password
          </Button>
        </div>
      </form>
    </>
  );
};
