import Footer from "../../components/shared/Footer";
import MetaInformation from "../../components/shared/MetaInformation";
import HeaderLight from "./HeaderLight";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
}

export default function Layout({ title, description, children }: LayoutProps) {
  return (
    <div className="mx-auto w-full">
      <MetaInformation title={title} description={description} />
      <HeaderLight />
      {
        <main className="max-w-8xl relative mx-auto flex w-full flex-col justify-center px-2 lg:px-8 xl:px-12">
          {children}
        </main>
      }
      <Footer />
    </div>
  );
}
