import HeaderLight from "../salespage/HeaderLight";
import Footer from "./Footer";
import MetaInformation from "./MetaInformation";

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
        <main className="max-w-8xl relative mx-auto flex w-full flex-col justify-center px-6 lg:px-24 xl:px-36 ">
          {children}
        </main>
      }
      <Footer />
    </div>
  );
}
