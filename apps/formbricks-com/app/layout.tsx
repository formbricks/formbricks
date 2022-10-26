export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <title>Formbricks</title>
      </head>
      <body>{children}</body>
    </html>
  );
}
