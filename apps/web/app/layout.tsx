import "./globals.css";

export const metadata = {
  title: "Formbricks",
  description: "Open-Source In-Product Survey Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen flex-col bg-slate-50">{children}</body>
    </html>
  );
}
