import { NoMobileOverlay } from "@formbricks/ui/NoMobileOverlay";

const AppLayout = ({ children }) => {
  return (
    <>
      <NoMobileOverlay />
      {children}
    </>
  );
};

export default AppLayout;
