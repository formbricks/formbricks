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
      <main className="relative flex flex-col justify-center mx-auto max-w-8xl sm:px-2 lg:px-8 xl:px-12">
        {children}
      </main>
      <Footer />
    </>
  );
}
