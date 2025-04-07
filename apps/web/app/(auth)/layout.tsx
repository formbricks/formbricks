import { IntercomClientWrapper } from "@/app/intercom/IntercomClientWrapper";
import { AlchemyWalletProvider, alchemyConfig } from "@/modules/alchemy-wallet";
import { NoMobileOverlay } from "@/modules/ui/components/no-mobile-overlay";
import { cookieToInitialState } from "@account-kit/core";
import { headers as nextHeaders } from "next/headers";

const AppLayout = async ({ children }) => {
  const headers = await nextHeaders();
  const alchemyInitialState = cookieToInitialState(alchemyConfig, headers.get("cookie") ?? undefined);

  return (
    <>
      <NoMobileOverlay />
      <IntercomClientWrapper />
      <AlchemyWalletProvider initialState={alchemyInitialState}>{children}</AlchemyWalletProvider>
    </>
  );
};

export default AppLayout;
