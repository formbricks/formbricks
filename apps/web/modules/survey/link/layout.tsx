import { cookieToInitialState } from "@account-kit/core";
import { Viewport } from "next";
import { headers as nextHeaders } from "next/headers";
import { AlchemyWalletProvider, alchemyConfig } from "@formbricks/web3";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  viewportFit: "contain",
};

export const LinkSurveyLayout = async ({ children }) => {
  const headers = await nextHeaders();
  const apiKey = process.env.ALCHEMY_API_KEY || "";
  const alchemyInitialState = cookieToInitialState(alchemyConfig(apiKey), headers.get("cookie") ?? undefined);

  return (
    <>
      <AlchemyWalletProvider initialState={alchemyInitialState} apiKey={apiKey}>
        <div className="h-dvh">{children}</div>;
      </AlchemyWalletProvider>
    </>
  );
  return;
};
