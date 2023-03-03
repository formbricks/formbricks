import "./globals.css";

export const metadata = {
  title: "Formbricks",
  description: "In-Product Survey Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
