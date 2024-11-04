"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { createUser } from "@formbricks/lib/utils/users";
import { ZUserName } from "@formbricks/types/user";
import { FormControl, FormError, FormField, FormItem } from "@formbricks/ui/components/Form";
import { Input } from "@formbricks/ui/components/Input";
import { Button } from "../Button";
import { PasswordInput } from "../PasswordInput";
import { AzureButton } from "./components/AzureButton";
import { GithubButton } from "./components/GithubButton";
import { GoogleButton } from "./components/GoogleButton";
import { IsPasswordValid } from "./components/IsPasswordValid";
import { OpenIdButton } from "./components/OpenIdButton";

interface SignupOptionsProps {
  emailAuthEnabled: boolean;
  emailFromSearchParams: string;
  setError?: (error: string) => void;
  emailVerificationDisabled: boolean;
  googleOAuthEnabled: boolean;
  githubOAuthEnabled: boolean;
  azureOAuthEnabled: boolean;
  oidcOAuthEnabled: boolean;
  inviteToken: string | null;
  callbackUrl: string;
  oidcDisplayName?: string;
  userLocale: string;
}

export const SignupOptions = ({
  emailAuthEnabled,
  emailFromSearchParams,
  setError,
  emailVerificationDisabled,
  googleOAuthEnabled,
  githubOAuthEnabled,
  azureOAuthEnabled,
  oidcOAuthEnabled,
  inviteToken,
  callbackUrl,
  oidcDisplayName,
  userLocale,
}: SignupOptionsProps) => {
  const [showLogin, setShowLogin] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  const [isButtonEnabled, setButtonEnabled] = useState(true);
  const t = useTranslations();

  const ZSignupInput = z.object({
    name: ZUserName,
    email: z.string().email(),
    password: z
      .string()
      .min(8)
      .regex(/^(?=.*[A-Z])(?=.*\d).*$/),
  });

  type TSignupInput = z.infer<typeof ZSignupInput>;
  const form = useForm<TSignupInput>({
    defaultValues: {
      name: "",
      email: emailFromSearchParams || "",
      password: "",
    },
    resolver: zodResolver(ZSignupInput),
  });

  const router = useRouter();

  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const checkFormValidity = () => {
    // If all fields are filled, enable the button
    if (formRef.current) {
      setButtonEnabled(formRef.current.checkValidity());
    }
  };

  const handleSubmit = async (data: TSignupInput) => {
    if (!isValid) {
      return;
    }

    setSigningUp(true);

    try {
      await createUser(data.name, data.email, data.password, userLocale, inviteToken);
      const url = emailVerificationDisabled
        ? `/auth/signup-without-verification-success`
        : `/auth/verification-requested?email=${encodeURIComponent(data.email)}`;

      router.push(url);
    } catch (e: any) {
      if (setError) {
        setError(e.message);
      }
      setSigningUp(false);
    }
  };

  return (
    <div className="space-y-2">
      {emailAuthEnabled && (
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} ref={formRef} onChange={checkFormValidity}>
            {showLogin && (
              <div>
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field, fieldState: { error } }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <div>
                            <Input
                              value={field.value}
                              autoFocus
                              onChange={(name) => field.onChange(name)}
                              placeholder="Full name"
                              className="bg-white"
                            />
                            {error?.message && <FormError className="text-left">{error.message}</FormError>}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field, fieldState: { error } }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <div>
                            <Input
                              value={field.value}
                              onChange={(email) => field.onChange(email)}
                              defaultValue={emailFromSearchParams}
                              placeholder="engineering@acme.com"
                              className="bg-white"
                            />
                            {error?.message && <FormError className="text-left">{error.message}</FormError>}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field, fieldState: { error } }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <div>
                            <PasswordInput
                              id="password"
                              name="password"
                              value={field.value}
                              onChange={(password) => field.onChange(password)}
                              autoComplete="current-password"
                              placeholder="*******"
                              aria-placeholder="password"
                              required
                              className="focus:border-brand-dark focus:ring-brand-dark block w-full rounded-md shadow-sm sm:text-sm"
                            />
                            {error?.message && <FormError className="text-left">{error.message}</FormError>}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <IsPasswordValid password={form.watch("password")} setIsValid={setIsValid} />
              </div>
            )}
            {showLogin && (
              <Button
                type="submit"
                className="h-10 w-full justify-center"
                loading={signingUp}
                disabled={formRef.current ? !isButtonEnabled || !isValid : !isButtonEnabled}>
                {t("auth.continue_with_email")}
              </Button>
            )}

            {!showLogin && (
              <Button
                type="button"
                onClick={() => {
                  setShowLogin(true);
                  setButtonEnabled(false);
                  // Add a slight delay before focusing the input field to ensure it's visible
                  setTimeout(() => nameRef.current?.focus(), 100);
                }}
                className="h-10 w-full justify-center">
                {t("auth.continue_with_email")}
              </Button>
            )}
          </form>
        </FormProvider>
      )}
      {googleOAuthEnabled && (
        <>
          <GoogleButton inviteUrl={callbackUrl} text={t("auth.continue_with_google")} />
        </>
      )}
      {githubOAuthEnabled && (
        <>
          <GithubButton inviteUrl={callbackUrl} text={t("auth.continue_with_github")} />
        </>
      )}
      {azureOAuthEnabled && (
        <>
          <AzureButton inviteUrl={callbackUrl} text={t("auth.continue_with_azure")} />
        </>
      )}
      {oidcOAuthEnabled && (
        <>
          <OpenIdButton inviteUrl={callbackUrl} text={t("auth.continue_with_oidc", { oidcDisplayName })} />
        </>
      )}
    </div>
  );
};
