import { IntercomClientWrapper } from "@/app/intercom/IntercomClientWrapper";
import { NoMobileOverlay } from "@/modules/ui/components/no-mobile-overlay";
import { AlchemyWalletProvider } from "@formbricks/web3";

const AppLayout = async ({ children }) => {
  const apiKey = process.env.ALCHEMY_API_KEY || "";

  return (
    <>
      <NoMobileOverlay />
      <IntercomClientWrapper />
      <AlchemyWalletProvider apiKey={apiKey}>{children}</AlchemyWalletProvider>
    </>
  );
};

export default AppLayout;
