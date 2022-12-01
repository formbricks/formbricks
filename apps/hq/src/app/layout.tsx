import "@/styles/globals.css";
import "@/styles/toastify.css";
import "@/styles/prism.css";
// include styles from the ui package

import SessionProvider from "./SessionProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <title>Formbricks HQ</title>
      </head>
      <body className="min-h-screen bg-gray-50">
        <SessionProvider>{children} </SessionProvider>
      </body>
    </html>
  );
}
