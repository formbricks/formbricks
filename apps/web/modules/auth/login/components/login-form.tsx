"use client";

import { AuthCard, useSigner, useSignerStatus, useUser } from "@account-kit/react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

interface LoginFormProps {
  emailAuthEnabled: boolean;
  publicSignUpEnabled: boolean;
  passwordResetEnabled: boolean;
  isMultiOrgEnabled: boolean;
}

export const LoginForm = ({}: LoginFormProps) => {
  const user = useUser();
  const signer = useSigner();
  const status = useSignerStatus();

  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || "";
  useEffect(() => {
    if (!user || !status.isConnected) return;

    (async () => {
      const credentials = await signer?.inner.stampWhoami();
      if (!credentials) {
        return;
      }

      const resp = await signIn("alchemy", {
        url: credentials.url,
        body: credentials.body,
        stampHeaderName: credentials.stamp.stampHeaderName,
        stampHeaderValue: credentials.stamp.stampHeaderValue,
        callbackUrl: callbackUrl ?? "/",
        redirect: false,
      });

      if (!resp?.error && resp?.ok) {
        window.location.reload();
      }
    })();
  }, [user, signer, status.isConnected, callbackUrl]);
  // const onSubmit: SubmitHandler<TLoginForm> = async (data) => {
  //   if (typeof window !== "undefined") {
  //     localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, "Email");
  //   }
  //   try {
  //     const signInResponse = await signIn("credentials", {
  //       callbackUrl: callbackUrl ?? "/",
  //       email: data.email.toLowerCase(),
  //       password: data.password,
  //       ...(totpLogin && { totpCode: data.totpCode }),
  //       ...(totpBackup && { backupCode: data.backupCode }),
  //       redirect: false,
  //     });

  //     if (signInResponse?.error === "second factor required") {
  //       setTotpLogin(true);
  //       return;
  //     }

  //     if (signInResponse?.error === "Email Verification is Pending") {
  //       const emailTokenActionResponse = await createEmailTokenAction({ email: data.email });
  //       if (emailTokenActionResponse?.data) {
  //         router.push(`/auth/verification-requested?token=${emailTokenActionResponse?.data}`);
  //       } else {
  //         const errorMessage = getFormattedErrorMessage(emailTokenActionResponse);
  //         toast.error(errorMessage);
  //       }
  //       return;
  //     }

  //     if (signInResponse?.error) {
  //       toast.error(signInResponse.error);
  //       return;
  //     }

  //     if (!signInResponse?.error) {
  //       router.push(searchParams?.get("callbackUrl") || "/");
  //     }
  //   } catch (error) {
  //     toast.error(error.toString());
  //   }
  // };

  return (
    <div className="text-center">
      <AuthCard />
    </div>
  );
};
