import { IntercomClient } from "@/app/IntercomClient";
import { NoMobileOverlay } from "@/modules/ui/components/no-mobile-overlay";
import { IS_INTERCOM_CONFIGURED } from "@formbricks/lib/constants";

const AppLayout = async ({ children }) => {
  return (
    <>
      <NoMobileOverlay />
      <IntercomClient isIntercomConfigured={IS_INTERCOM_CONFIGURED} />
      {children}
    </>
  );
};

export default AppLayout;
