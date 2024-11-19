"use client";

import { IsPasswordValid } from "@/modules/auth/components/SignupOptions/components/IsPasswordValid";
import { XCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { resetPassword } from "@formbricks/lib/utils/users";
import { Button } from "@formbricks/ui/components/Button";
import { PasswordInput } from "@formbricks/ui/components/PasswordInput";

export const ResetPasswordForm = () => {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string>("");
  const [password, setPassword] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t("auth.forgot-password.reset.passwords_do_not_match"));
      return;
    }
    setLoading(true);
    const token = searchParams?.get("token");
    try {
      if (!token) throw new Error(t("auth.forgot-password.reset.no_token_provided"));
      await resetPassword(token, e.target.elements.password.value);

      router.push("/auth/forgot-password/reset/success");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
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
              <h3 className="text-sm font-medium text-red-800">
                {t("auth.forgot-password.an_error_occurred_when_logging_you_in")}
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p className="space-y-1 whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-800">
              {t("auth.forgot-password.reset.new_password")}
            </label>
            <PasswordInput
              id="password"
              name="password"
              value={password ?? ""}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="*******"
              required
              className="focus:border-brand-dark focus:ring-brand-dark mt-2 block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-800">
              {t("auth.forgot-password.reset.confirm_password")}
            </label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword ?? ""}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="*******"
              required
              className="focus:border-brand-dark focus:ring-brand-dark mt-2 block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
            />
          </div>

          <IsPasswordValid password={password} setIsValid={setIsValid} />
        </div>

        <div>
          <Button type="submit" disabled={!isValid} className="w-full justify-center" loading={loading}>
            {t("auth.forgot-password.reset_password")}
          </Button>
        </div>
      </form>
    </>
  );
};
