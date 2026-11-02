"use client";

import dynamic from "next/dynamic";

// The email gate renders only for surveys with email verification on, but `survey-renderer` is a
// Server Component, and a Client Component it imports statically ships in every link survey's
// first-load JS. Loading it through `next/dynamic` from this client boundary moves it — with the
// HTML parser `getTextContent` brings — into a chunk fetched only when the gate actually renders.
// The cost is one round trip on email-gated surveys: the root `I18nProvider` renders nothing until
// its locale has loaded, on the server too, so the chunk is requested only after that.
export const VerifyEmail = dynamic(() =>
  import("@/modules/survey/link/components/verify-email").then((module) => module.VerifyEmail)
);
