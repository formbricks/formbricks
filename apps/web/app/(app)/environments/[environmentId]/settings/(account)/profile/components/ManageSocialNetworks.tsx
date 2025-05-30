"use client";

import { Button } from "@/modules/ui/components/button";
import { createBrowserClient } from "@supabase/ssr";
import { Provider } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { TUser } from "@formbricks/types/user";

export const ManageSocialNetworks = ({
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

  const searchParams = useSearchParams();
  const provider = searchParams.get("provider");

  const login = async (provider: Provider) => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.href}?provider=${provider}`,
      },
    });
  };

  useEffect(() => {
    (async () => {
      if (provider) {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          console.log(data.session.access_token);
        }
      }
    })();
  }, [provider, supabase.auth]);

  if (!supabase) {
    return null;
  }
  return (
    <div>
      <Button onClick={() => login("discord")}>Connect Discord</Button>
    </div>
  );
};
