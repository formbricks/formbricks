import Footer from "../../components/shared/Footer";
import MetaInformation from "../../components/shared/MetaInformation";
import HeaderTribe from "./HeaderTribe";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
}

export default function Layout({ title, description, children }: LayoutProps) {
  return (
    <div className="mx-auto bg-gradient-to-br from-slate-800 via-slate-900 to-slate-900">
      <MetaInformation title={title} description={description} />
      <HeaderTribe />
      <main className="">{children}</main>
      <Footer />
    </div>
  );
}
