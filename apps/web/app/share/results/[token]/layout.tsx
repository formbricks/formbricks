import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared Results",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

const ShareResultsLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-slate-50">
      <main className="min-h-screen">{children}</main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        Powered by Formbricks
      </footer>
    </div>
  );
};

export default ShareResultsLayout;
