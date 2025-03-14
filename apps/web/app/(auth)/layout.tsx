import { IntercomClient } from "@/app/IntercomClient";
import { NoMobileOverlay } from "@/modules/ui/components/no-mobile-overlay";
import React from "react";
import { INTERCOM_APP_ID, INTERCOM_SECRET_KEY, IS_INTERCOM_CONFIGURED } from "@formbricks/lib/constants";

const AppLayout = async ({ children }) => {
  return (
    <>
      <NoMobileOverlay />
      <IntercomClient
        isIntercomConfigured={IS_INTERCOM_CONFIGURED}
        intercomSecretKey={INTERCOM_SECRET_KEY}
        intercomAppId={INTERCOM_APP_ID}
      />
      {children}
    </>
  );
};

export default AppLayout;
