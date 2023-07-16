import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import PosthogIdentify from "../environments/[environmentId]/PosthogIdentify";
import { PosthogClientWrapper } from "../PosthogClientWrapper";

export default async function EnvironmentLayout({ children }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return redirect(`/auth/login`);
  }

  return (
    <>
      <PosthogIdentify session={session} />
      <PosthogClientWrapper>{children}</PosthogClientWrapper>
    </>
  );
}
