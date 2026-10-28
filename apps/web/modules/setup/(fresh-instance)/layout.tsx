import { notFound } from "next/navigation";
import { getIsFreshInstance } from "@/lib/instance/service";
import { getSession } from "@/modules/auth/lib/session";

export const FreshInstanceLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
  const session = await getSession();
  const isFreshInstance = await getIsFreshInstance();

  // Setup exists for the first administrator only, who has no session yet.
  if (!isFreshInstance || session) {
    return notFound();
  }

  return <>{children}</>;
};
