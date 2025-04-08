import { alchemyConfig, AlchemyWalletProvider } from "@/modules/alchemy-wallet";
import { cookieToInitialState } from "@account-kit/core";
import { Viewport } from "next";
import { headers as nextHeaders } from "next/headers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  viewportFit: "contain",
};

export const LinkSurveyLayout = async ({ children }) => {
  const headers = await nextHeaders();
    const alchemyInitialState = cookieToInitialState(alchemyConfig, headers.get("cookie") ?? undefined);
  
    return (
      <>
        <AlchemyWalletProvider initialState={alchemyInitialState}>
          <div className="h-dvh">{children}</div>;
        </AlchemyWalletProvider>
      </>
    );
  return 
};
