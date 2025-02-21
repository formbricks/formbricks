"use client";

import { TolgeeProvider, TolgeeStaticData } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import branch from "../../../branch.json";
import { TolgeeBase } from "./shared";

type Props = {
  language: string;
  staticData: TolgeeStaticData;
  children: React.ReactNode;
};

const tolgee = TolgeeBase().init({
  tagNewKeys: [`draft:${branch.branchName}`],
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
