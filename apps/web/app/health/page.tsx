import { CheckBadgeIcon } from "@heroicons/react/24/outline";
import { Metadata } from "next";

import { prisma } from "@formbricks/database";
import { env } from "@formbricks/lib/env.mjs";
import { testS3Connection } from "@formbricks/lib/storage/service";

export const dynamic = "force-dynamic"; // no caching

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

const checkDatabaseConnection = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    throw new Error("Database could not be reached");
  }
};

const checkS3Connection = async () => {
  if (!env.S3_ACCESS_KEY) {
    // dont try connecting if not in use
    return;
  }

  await testS3Connection();
};

export default async function HealthPage() {
  await checkDatabaseConnection();
  await checkS3Connection();

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center">
      <CheckBadgeIcon height={40} color="green" />
      <p className="text-md mt-4 font-bold text-zinc-900">All systems are up and running</p>
    </div>
  );
}
