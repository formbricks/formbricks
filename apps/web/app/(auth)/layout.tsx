import { NoMobileOverlay } from "@/modules/ui/components/no-mobile-overlay";

const AppLayout = async ({ children }) => {
  return (
    <>
      <NoMobileOverlay />
      {children}
    </>
  );
};

export default AppLayout;
