import Footer from "./Footer";
import MetaInformation from "./MetaInformation";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
}

export default function Layout({ title, description, children }: LayoutProps) {
  return (
    <div className="flex h-screen flex-col justify-between">
      <MetaInformation title={title} description={description} />
      {
        <main className="max-w-8xl relative mx-auto mb-auto flex w-full flex-col justify-center sm:px-2 lg:px-8 xl:px-12">
          {children}
        </main>
      }
      <Footer />
    </div>
  );
}
