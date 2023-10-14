import { PHProvider, PostHogPageview } from "../components/PostHogClient";
import { Suspense } from "react";
import { NoMobileOverlay } from "@formbricks/ui/NoMobileOverlay";

export default function AppLayout({ children }) {
  return (
    <>
      <NoMobileOverlay />
      <Suspense>
        <PostHogPageview />
      </Suspense>
      <PHProvider>{children}</PHProvider>
    </>
  );
}
