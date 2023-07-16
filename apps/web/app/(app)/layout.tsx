import { PHProvider, PostHogPageview } from "./PostHogClient";
import { Suspense } from "react";

export default function AppLayout({ children }) {
  return (
    <>
      <Suspense>
        <PostHogPageview />
      </Suspense>
      <PHProvider>{children}</PHProvider>
    </>
  );
}
