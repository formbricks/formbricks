import Footer from "../shared/Footer";
import MetaInformation from "../shared/MetaInformation";
import HeaderLight from "./HeaderLight";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
}

export default function LayoutLight({ title, description, children }: LayoutProps) {
  return (
    <div className="mx-auto w-full">
      <MetaInformation title={title} description={description} />
      <HeaderLight />
      <main className="max-w-8xl relative mx-auto flex w-full flex-col justify-center space-y-24 px-6 lg:space-y-40 lg:px-24 xl:px-36 ">
        {children}
      </main>
      <Footer />
    </div>
  );
}
