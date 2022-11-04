import Footer from "./Footer";
import Header from "./Header";
import MetaInformation from "./MetaInformation";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
}

export default function Layout({ title, description, children }: LayoutProps) {
  return (
    <>
      <MetaInformation title={title} description={description} />
      <Header />
      <main className="max-w-8xl relative mx-auto flex flex-col justify-center sm:px-2 lg:px-8 xl:px-12">
        {children}
      </main>
      <Footer />
    </>
  );
}
