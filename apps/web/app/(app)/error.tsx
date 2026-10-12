"use client";

// Sits inside `(app)/layout.tsx` so a page crash keeps the layout -- and its `SentryUser` -- mounted
// while the boundary reports, instead of the root boundary unmounting it and clearing the user first.
export { default } from "@/app/error";
