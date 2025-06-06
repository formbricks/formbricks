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
import {
  connectSocialAccountAction,
  disconnectSocialAccountAction,
  getUserSocialAccountsAction,
} from "../actions";

type SocialAccountInfo = {
  connected: boolean;
  socialName?: string;
};

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

  const [userSocials, setUserSocials] = useState<Record<string, SocialAccountInfo>>({});

  const [isAuthenticating, setIsAuthenticating] = useState<Record<string, boolean>>({});
  const [isDisconnecting, setIsDisconnecting] = useState<Record<string, boolean>>({});

  //prevents duplicate handler calls after redirect
  const [processedProviders, setProcessedProviders] = useState<Record<string, boolean>>({});

  const loadUserSocials = useCallback(async () => {
    try {
      const result = await getUserSocialAccountsAction();

      const socialAccounts = result?.data || [];
      const connected = socialAccounts.reduce(
        (acc, account) => {
          acc[account.provider] = {
            connected: true,
            socialName: account.socialName,
          };
          return acc;
        },
        {} as Record<string, SocialAccountInfo>
      );

      setUserSocials(connected);
    } catch (error) {
      console.error("Error loading user social accounts from DB:", error);
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
              socialAvatar: identity.identity_data?.avatar_url || null,
            };

            try {
              const result = await connectSocialAccountAction(socialData);

              if (result) {
                setUserSocials((prev) => ({
                  ...prev,
                  [providerName]: {
                    connected: true,
                    socialName: socialData.socialName,
                  },
                }));

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

  const disconnectSocial = async (provider: Provider) => {
    setIsDisconnecting({ ...isDisconnecting, [provider]: true });

    try {
      const result = await disconnectSocialAccountAction({ provider });

      if (result) {
        setUserSocials((prev) => {
          const updated = { ...prev };
          delete updated[provider];
          return updated;
        });

        // to process auth callback again when reconnect the social account just after disconnect
        setProcessedProviders((prev) => {
          const updated = { ...prev };
          delete updated[provider];
          return updated;
        });
        toast.success(
          t("environments.settings.profile.social_account_successfully_disconnected", {
            provider,
          })
        );
      } else {
        toast.error(
          t("environments.settings.profile.failed_to_disconnect_social_account", {
            provider,
          })
        );
      }
    } catch (error) {
      console.error(`Failed to disconnect ${provider}:`, error);
      toast.error(
        t("environments.settings.profile.failed_to_disconnect_social_account", {
          provider,
        })
      );
    } finally {
      setIsDisconnecting({ ...isDisconnecting, [provider]: false });
    }
  };

  useEffect(() => {
    if (user) {
      loadUserSocials();
    }
  }, [user, loadUserSocials]);

  //process social auth callback after social login
  useEffect(() => {
    if (provider && !processedProviders[provider]) {
      (async () => {
        try {
          setProcessedProviders((prev) => ({ ...prev, [provider]: true }));

          await handleSocialAuthCallback(provider);

          const currentPath = window.location.pathname;
          router.replace(currentPath);
        } catch (error) {
          console.error("Error processing social auth callback:", error);
          setProcessedProviders((prev) => ({ ...prev, [provider]: false }));
        }
      })();
    }
  }, [provider, processedProviders, handleSocialAuthCallback, router]);

  const SocialLogo = ({ provider, connected }: { provider: string; connected?: boolean }) => {
    switch (provider) {
      case "discord":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill={connected ? "#5865F2" : "#FFFFFF"}
            className="bi bi-discord"
            viewBox="0 0 16 16">
            <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612" />
          </svg>
        );
      case "twitter":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill={connected ? "#1DA1F2" : "#FFFFFF"}
            className="bi bi-twitter"
            viewBox="0 0 16 16">
            <path d="M5.026 15c6.038 0 9.341-5.003 9.341-9.334q.002-.211-.006-.422A6.7 6.7 0 0 0 16 3.542a6.7 6.7 0 0 1-1.889.518 3.3 3.3 0 0 0 1.447-1.817 6.5 6.5 0 0 1-2.087.793A3.286 3.286 0 0 0 7.875 6.03a9.32 9.32 0 0 1-6.767-3.429 3.29 3.29 0 0 0 1.018 4.382A3.3 3.3 0 0 1 .64 6.575v.045a3.29 3.29 0 0 0 2.632 3.218 3.2 3.2 0 0 1-.865.115 3 3 0 0 1-.614-.057 3.28 3.28 0 0 0 3.067 2.277A6.6 6.6 0 0 1 .78 13.58a6 6 0 0 1-.78-.045A9.34 9.34 0 0 0 5.026 15" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (!supabase) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={() => (userSocials["discord"]?.connected ? disconnectSocial("discord") : login("discord"))}
          disabled={isAuthenticating["discord"] || isDisconnecting["discord"]}
          variant={userSocials["discord"]?.connected ? "outline" : "default"}
          className={`flex items-center justify-center ${
            !userSocials["discord"]?.connected ? "bg-[#5865F2] text-white hover:bg-[#5865F2]/80" : ""
          }`}>
          {isAuthenticating["discord"] ? (
            t("environments.settings.profile.connecting")
          ) : isDisconnecting["discord"] ? (
            t("environments.settings.profile.disconnecting")
          ) : userSocials["discord"]?.connected ? (
            <>
              <SocialLogo provider="discord" connected={true} />
              <span className="max-w-[120px] truncate">{userSocials["discord"].socialName}</span>
              <span className="ml-2 text-xs text-gray-500">{t("common.disconnect")}</span>
            </>
          ) : (
            <>
              <SocialLogo provider="discord" connected={false} />
              {t("environments.settings.profile.connect_discord")}
            </>
          )}
        </Button>

        <Button
          onClick={() => (userSocials["twitter"]?.connected ? disconnectSocial("twitter") : login("twitter"))}
          disabled={isAuthenticating["twitter"] || isDisconnecting["twitter"]}
          variant={userSocials["twitter"]?.connected ? "outline" : "default"}
          className={`flex items-center justify-center ${
            !userSocials["twitter"]?.connected ? "bg-[#1DA1F2] text-white hover:bg-[#1DA1F2]/80" : ""
          }`}>
          {isAuthenticating["twitter"] ? (
            t("environments.settings.profile.connecting")
          ) : isDisconnecting["twitter"] ? (
            t("environments.settings.profile.disconnecting")
          ) : userSocials["twitter"]?.connected ? (
            <>
              <SocialLogo provider="twitter" connected={true} />
              <span className="max-w-[120px] truncate">{userSocials["twitter"].socialName}</span>
              <span className="ml-2 text-xs text-gray-500">{t("common.disconnect")}</span>
            </>
          ) : (
            <>
              <SocialLogo provider="twitter" connected={false} />
              {t("environments.settings.profile.connect_twitter")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
