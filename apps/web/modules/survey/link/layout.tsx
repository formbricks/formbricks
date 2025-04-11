import { Viewport } from "next";
import { AlchemyWalletProvider } from "@formbricks/web3";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  viewportFit: "contain",
};

export const LinkSurveyLayout = async ({ children }) => {
  const apiKey = process.env.ALCHEMY_API_KEY || "";

  return (
    <>
      <AlchemyWalletProvider apiKey={apiKey}>
        <div className="h-dvh">{children}</div>;
      </AlchemyWalletProvider>
    </>
  );
  return;
};
