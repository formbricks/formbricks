import { NoMobileOverlay } from "@formbricks/ui/NoMobileOverlay";

export default function AppLayout({ children }) {
  return (
    <>
      <NoMobileOverlay />
      {children}
    </>
  );
}
