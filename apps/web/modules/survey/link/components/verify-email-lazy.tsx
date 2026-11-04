"use client";

import dynamic from "next/dynamic";

// The email gate renders only for surveys with email verification on, but `survey-renderer` is a
// Server Component, and a Client Component it imports statically ships in every link survey's
// first-load JS. Loading it through `next/dynamic` from this client boundary moves it — with the
// HTML parser `getTextContent` brings — into a chunk fetched only when the gate actually renders.
// The root `I18nProvider` renders the page on the server, so the gate is in the server HTML and its
// chunk loads with the page rather than after a client render.
export const VerifyEmail = dynamic(() =>
  import("@/modules/survey/link/components/verify-email").then((module) => module.VerifyEmail)
);
