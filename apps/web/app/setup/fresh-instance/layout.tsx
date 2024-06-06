import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";
import { getIsFreshInstance } from "@formbricks/lib/instance/service";

const FreshInstanceLayout = async ({ children }: { children: React.ReactNode }) => {
  let isFreshInstance = false;
  try {
    isFreshInstance = await getIsFreshInstance();
  } catch (error) {
    console.log(error);
  }

  const session = await getServerSession(authOptions);
  if (session || !isFreshInstance) {
    return notFound();
  }
  if (!isFreshInstance) return notFound();
  return <>{children}</>;
};

export default FreshInstanceLayout;
