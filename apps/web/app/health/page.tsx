import { CheckBadgeIcon } from "@heroicons/react/24/outline";
import { Metadata } from "next";

import { prisma } from "@formbricks/database";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

const checkDatabaseConnection = async (): Promise<boolean> =>
  await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);

export default async function HealthPage() {
  const connectedToDatabase = await checkDatabaseConnection();
  if (!connectedToDatabase) {
    throw new Error("Database could not be reached");
  }

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center">
      <CheckBadgeIcon height={40} color="green" />
      <p className="text-md mt-4 font-bold text-zinc-900">All systems are up and running</p>
    </div>
  );
}
