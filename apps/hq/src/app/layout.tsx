"use client";

import "@/styles/globals.css";
import "@/styles/toastify.css";
// include styles from the ui package

import { SessionProvider } from "next-auth/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className="h-full bg-white">
      <head></head>
      <body>
        <SessionProvider>{children} </SessionProvider>
      </body>
    </html>
  );
}
