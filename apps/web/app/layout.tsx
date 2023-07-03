import "./globals.css";
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | Formbricks',
    default: "Formbricks",
  },
  description: "Open-Source In-Product Survey Platform"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen flex-col bg-slate-50">{children}</body>
    </html>
  );
}
