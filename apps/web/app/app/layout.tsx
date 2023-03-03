import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    redirect(`/auth/login`);
  }
  return children;
}
