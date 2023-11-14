import { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Formbricks",
    default: "Formbricks",
  },
  description: "Open-Source Survey Suite",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen flex-col bg-slate-50">{children}</body>
    </html>
  );
}
