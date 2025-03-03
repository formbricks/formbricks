"use client";

import { TolgeeProvider, TolgeeStaticData } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TolgeeBase } from "./shared";

// Try to import branch.json, but handle the case where it doesn't exist
let branchName: string | undefined;
try {
  const branch = require("../../../branch.json");
  branchName = branch.branchName;
} catch (e) {
  // File doesn't exist in production, so we'll use undefined
  branchName = undefined;
}

type Props = {
  language: string;
  staticData: TolgeeStaticData;
  children: React.ReactNode;
};

const tolgee = TolgeeBase().init({
  tagNewKeys: branchName ? [`draft:${branchName}`] : [],
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
