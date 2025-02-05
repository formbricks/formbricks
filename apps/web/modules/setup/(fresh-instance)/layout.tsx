import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { getIsFreshInstance } from "@formbricks/lib/instance/service";

export const FreshInstanceLayout = async ({ children }: { children: React.ReactNode }) => {
  const session = await getServerSession(authOptions);
  const isFreshInstance = await getIsFreshInstance();

  if (session || !isFreshInstance) {
    return notFound();
  }
  return <>{children}</>;
};
