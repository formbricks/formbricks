import { FormbricksIntro } from "@/app/setup/intro/components/FormbricksIntro";
import { Metadata } from "next";
import { redirect } from "next/navigation";

import { getIsFreshInstance } from "@formbricks/lib/user/service";

export const metadata: Metadata = {
  title: "Intro",
  description: "Open-source Experience Management. Free & open source.",
};

const Page = async () => {
  const isFreshInstance = await getIsFreshInstance();
  if (!isFreshInstance) {
    redirect("/404");
  }
  return <FormbricksIntro />;
};

export default Page;
