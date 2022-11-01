import { useRouter } from "next/router";

import navigation from "@/lib/navigation";
import Footer from "./Footer";
import Header from "./Header";

interface LayoutProps {
  children: React.ReactNode;
  meta: {
    title: string;
  };
}

export default function Layout({ children }: LayoutProps) {
  return (
    <>
      <Header />

      <main className="max-w-8xl relative mx-auto flex flex-col justify-center sm:px-2 lg:px-8 xl:px-12">
        {children}
      </main>
      <Footer />
    </>
  );
}
