import { NoMobileOverlay } from "@formbricks/ui/components/NoMobileOverlay";

const AppLayout = async ({ children }) => {
  return (
    <>
      <NoMobileOverlay />
      {children}
    </>
  );
};

export default AppLayout;
