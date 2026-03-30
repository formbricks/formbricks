import { NoMobileOverlay } from "@/modules/ui/components/no-mobile-overlay";

const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <NoMobileOverlay />
      {children}
    </>
  );
};

export default AppLayout;
