import { IntercomClientWrapper } from "@/app/intercom/IntercomClientWrapper";
import { NoMobileOverlay } from "@/modules/ui/components/no-mobile-overlay";
import React from "react";

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
