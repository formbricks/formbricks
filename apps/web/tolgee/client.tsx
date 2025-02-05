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

let branchName: string;

try {
  branchName = require("../../../branch.json").branchName;
} catch (error) {
  console.warn("branch.json not found, using default branch name.");
  branchName = "main"; // Fallback value
}

const tolgee = TolgeeBase().init({
  tagNewKeys: [`draft: ${branchName}`],
});

export const TolgeeNextProvider = ({ language, staticData, children }: Props) => {
  const router = useRouter();

  useEffect(() => {
    // this ensures server components refresh, after translation change
    const { unsubscribe } = tolgee.on("permanentChange", () => {
      router.refresh();
    });
    return () => unsubscribe();
  }, [tolgee, router]);

  return (
    <TolgeeProvider tolgee={tolgee} fallback="Loading" ssr={{ language, staticData }}>
      {children}
    </TolgeeProvider>
  );
};
