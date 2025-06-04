"use client";

import { Button } from "@/modules/ui/components/button";
import { createBrowserClient } from "@supabase/ssr";
import { Provider } from "@supabase/supabase-js";
import { useTranslate } from "@tolgee/react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { TUser } from "@formbricks/types/user";
import { connectSocialAccountAction, getUserSocialAccountsAction } from "../actions";

export const ManageSocialNetworks = ({
  user,
  SUPABASE_KEY,
  SUPABASE_URL,
}: {
  user: TUser;
  SUPABASE_KEY: string;
  SUPABASE_URL: string;
}) => {
  const supabase = useMemo(() => {
    return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  }, [SUPABASE_URL, SUPABASE_KEY]);

  const { t } = useTranslate();

  const searchParams = useSearchParams();
  const provider = searchParams.get("provider");
  const router = useRouter();
  const [userSocials, setUserSocials] = useState<Record<string, boolean>>({});
  const [isAuthenticating, setIsAuthenticating] = useState<Record<string, boolean>>({});
  //prevents duplicate handler calls after redirect
  const [processedProviders, setProcessedProviders] = useState<Record<string, boolean>>({});

  const loadUserSocials = useCallback(async () => {
    try {
      const result = await getUserSocialAccountsAction();

      const socialAccounts = result?.data || [];
      const connected = socialAccounts.reduce(
        (acc, account) => {
          acc[account.provider] = true;
          return acc;
        },
        {} as Record<string, boolean>
      );

      setUserSocials(connected);
    } catch (error) {
      console.error("Error loading user social accounts:", error);
      setUserSocials({});
    }
  }, []);

  const login = async (provider: Provider) => {
    setIsAuthenticating({ ...isAuthenticating, [provider]: true });

    try {
      const currentUrl = window.location.href.split("?")[0];
      const redirectURL = `${currentUrl}?provider=${provider}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectURL,
        },
      });

      if (error) {
        console.error(`Failed to connect ${provider}: `, error);
        toast.error(
          t("environments.settings.profile.failed_to_connect_social_account", { provider: provider })
        );
        setIsAuthenticating({ ...isAuthenticating, [provider]: false });
      }
    } catch (err) {
      console.error(`Failed to connect ${provider}: `, err);
      setIsAuthenticating({ ...isAuthenticating, [provider]: false });
    }
  };

  const handleSocialAuthCallback = useCallback(
    async (providerName: string) => {
      if (processedProviders[providerName]) {
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Error checking auth status:", error);
          return;
        }

        if (data?.session) {
          const identities = data.session.user?.identities || [];
          const identity = identities.find((identity) => identity.provider === providerName);

          if (identity) {
            setProcessedProviders((prev) => ({ ...prev, [providerName]: true }));

            const socialData = {
              userId: user.id,
              provider: providerName,
              socialId: identity.id,
              socialName: identity.identity_data?.user_name,
              socialEmail: identity.identity_data?.email,
              socialAvatar: identity.identity_data?.avatar_url || identity.identity_data?.picture || null,
            };

            try {
              const result = await connectSocialAccountAction(socialData);

              if (result) {
                setUserSocials((prev) => ({ ...prev, [providerName]: true }));

                toast.success(
                  t("environments.settings.profile.social_account_successfully_connected", {
                    provider: providerName,
                  })
                );

                await loadUserSocials();
              } else {
                toast.error(
                  t("environments.settings.profile.failed_to_connect_social_account", {
                    provider: providerName,
                  })
                );
              }
            } catch (error) {
              console.error("Error connecting social account:", error);
              toast.error(
                t("environments.settings.profile.failed_to_connect_social_account", {
                  provider: providerName,
                })
              );
            }
          } else {
            console.error("No identity found for ", providerName);
          }
        } else {
          console.error("No Supabase session found.");
        }
      } catch (err) {
        console.error("Error processing social auth callback:", err);
      } finally {
        setIsAuthenticating((prev) => ({ ...prev, [providerName]: false }));
      }
    },
    [processedProviders, supabase.auth, user.id, t, loadUserSocials]
  );

  useEffect(() => {
    if (user) {
      loadUserSocials();
    }
  }, [user, loadUserSocials]);

  //process social auth callback after social login
  useEffect(() => {
    if (provider) {
      (async () => {
        try {
          await handleSocialAuthCallback(provider);

          const currentPath = window.location.pathname;
          router.replace(currentPath);
        } catch (error) {
          console.error("Error in OAuth effect:", error);
        }
      })();
    }
  }, [provider, handleSocialAuthCallback, router]);

  if (!supabase) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={() => login("discord")}
          disabled={isAuthenticating["discord"] || userSocials["discord"]}
          variant={userSocials["discord"] ? "outline" : "default"}>
          {isAuthenticating["discord"]
            ? t("environments.settings.profile.connecting")
            : userSocials["discord"]
              ? t("environments.settings.profile.discord_connected")
              : t("environments.settings.profile.connect_discord")}
        </Button>

        <Button
          onClick={() => login("twitter")}
          disabled={isAuthenticating["twitter"] || userSocials["twitter"]}
          variant={userSocials["twitter"] ? "outline" : "default"}>
          {isAuthenticating["twitter"]
            ? t("environments.settings.profile.connecting")
            : userSocials["twitter"]
              ? t("environments.settings.profile.twitter_connected")
              : t("environments.settings.profile.connect_twitter")}
        </Button>
      </div>
    </div>
  );
};
