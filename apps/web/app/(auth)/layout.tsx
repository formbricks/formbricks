import { IntercomClientWrapper } from "@/app/intercom/IntercomClientWrapper";
import { NoMobileOverlay } from "@/modules/ui/components/no-mobile-overlay";

const AppLayout = async ({ children }) => {
  return (
    <>
      <NoMobileOverlay />
      <IntercomClientWrapper />
      {children}
    </>
  );
};

export default AppLayout;
