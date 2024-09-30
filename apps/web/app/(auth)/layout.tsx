import { NoMobileOverlay } from "@formbricks/ui/components/NoMobileOverlay";

const AppLayout = ({ children }) => {
  return (
    <>
      <NoMobileOverlay />
      {children}
    </>
  );
};

export default AppLayout;
