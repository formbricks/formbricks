"use client";

import { TolgeeProvider, TolgeeStaticData } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TolgeeBase } from "./shared";

type Props = {
  language: string;
  staticData: TolgeeStaticData;
  children: React.ReactNode;
};

// Handle branch.json which is only available in dev environment
const getBranchTag = () => {
  try {
    // Dynamic import with require to avoid build errors in production
    const branch =
      process.env.NODE_ENV === "development" ? require("../../../branch.json") : { branchName: "main" }; // Default fallback for production

    return `draft:${branch.branchName}`;
  } catch (e) {
    // Fallback if file doesn't exist
    return "draft:main";
  }
};

const tolgee = TolgeeBase().init({
  tagNewKeys: [getBranchTag()],
});

export const TolgeeNextProvider = ({ language, staticData, children }: Props) => {
  const router = useRouter();

  useEffect(() => {
    // this ensures server components refresh, after translation change
    const { unsubscribe } = tolgee.on("permanentChange", () => {
      router.refresh();
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tolgee, router]);

  return (
    <TolgeeProvider tolgee={tolgee} fallback="Loading" ssr={{ language, staticData }}>
      {children}
    </TolgeeProvider>
  );
};
