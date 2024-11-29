import { IntercomClient } from "@/app/IntercomClient";
import { NoMobileOverlay } from "@/modules/ui/components/no-mobile-overlay";
import { INTERCOM_SECRET_KEY, IS_INTERCOM_CONFIGURED } from "@formbricks/lib/constants";

const AppLayout = async ({ children }) => {
  return (
    <>
      <NoMobileOverlay />
      <IntercomClient isIntercomConfigured={IS_INTERCOM_CONFIGURED} intercomSecretKey={INTERCOM_SECRET_KEY} />
      {children}
    </>
  );
};

export default AppLayout;
