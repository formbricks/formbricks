import { FormbricksIntro } from "@/app/setup/intro/components/FormbricksIntro";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Open-source Experience Management. Free & open source.",
};

const Page = () => {
  return <FormbricksIntro />;
};

export default Page;
