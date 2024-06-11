import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { getIsFreshInstance } from "@formbricks/lib/instance/service";

const FreshInstanceLayout = async ({ children }: { children: React.ReactNode }) => {
  const session = await getServerSession(authOptions);
  const isFreshInstance = await getIsFreshInstance();

  if (session || !isFreshInstance) {
    return notFound();
  }
  if (!isFreshInstance) return notFound();
  return <>{children}</>;
};

export default FreshInstanceLayout;
